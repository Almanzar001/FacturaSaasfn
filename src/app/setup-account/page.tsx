'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupAccountPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Poll the database for the organization_id
      const interval = setInterval(async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (profile?.organization_id) {
          clearInterval(interval)
          router.push('/configuraciones')
        }
      }, 1000) // Check every second

      // Cleanup interval on component unmount
      return () => clearInterval(interval)
    }

    checkOrganization()
  }, [router, supabase])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h1 className="text-2xl font-bold mt-6">Configurando tu cuenta...</h1>
        <p className="text-gray-600 mt-2">
          Estamos preparando todo para ti. Esto solo tomará un momento.
        </p>
      </div>
    </div>
  )
}