import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Only handle onboarding redirect for dashboard access
  if (session && pathname === '/dashboard') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, organization_id, role')
        .eq('id', session.user.id)
        .single()

      // If user has organization but onboarding not complete, redirect to settings
      // But only if they have permission to access settings (propietario or administrador)
      if (profile?.organization_id && !profile.onboarding_completed) {
        const userRole = profile.role || 'vendedor'
        if (userRole === 'propietario' || userRole === 'administrador') {
          return NextResponse.redirect(new URL('/configuraciones', request.url))
        }
        // For vendedores, let them access dashboard even if onboarding is not complete
      }
    } catch (error) {
      // If there's an error fetching profile, let the request continue
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}