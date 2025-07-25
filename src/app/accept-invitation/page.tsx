'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function AcceptInvitationComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [invitationEmail, setInvitationEmail] = useState('')

  useEffect(() => {
    if (!token) {
      setError('No se proporcionó un token de invitación.')
      setLoading(false)
      return
    }

    const processInvitation = async () => {
      try {
        const { data: invitationData, error: invitationError } = await supabase.rpc('get_invitation_details', { p_token: token })
        
        if (invitationError || !invitationData || invitationData.length === 0) {
          throw new Error('Invitación no válida o expirada.')
        }

        const invitation = invitationData[0]
        if (invitation.status !== 'pending') {
          throw new Error('Esta invitación ya ha sido aceptada o ha expirado.')
        }
        
        setInvitationEmail(invitation.email)

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          if (session.user.email !== invitation.email) {
            throw new Error('La invitación es para un correo diferente al de tu sesión actual. Por favor, cierra sesión e inténtalo de nuevo.')
          }
          setUser(session.user)
          await acceptInvitation(session.user.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al procesar la invitación.')
      } finally {
        setLoading(false)
      }
    }
    processInvitation()
  }, [token])

  const acceptInvitation = async (userId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.rpc('accept_invitation', {
        p_token: token,
        p_user_id: userId,
      })
      if (error) throw error
      router.push('/dashboard') // Redirigir al dashboard después de aceptar
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aceptar la invitación.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUpAndAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !invitationEmail) return

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: invitationEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) throw signUpError
      if (!data.user) throw new Error('No se pudo crear el usuario.')

      // Actualizar perfil y aceptar invitación
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
      await acceptInvitation(data.user.id)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse.')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    const isWrongEmailError = error.includes('correo diferente al de tu sesión actual')
    
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isWrongEmailError ? 'Correo Incorrecto' : 'Error'}</CardTitle>
            {isWrongEmailError && (
              <CardDescription>
                Esta invitación es para el correo: <strong>{invitationEmail}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-red-500 mb-4">{error}</p>
            <div className="space-y-2">
              {isWrongEmailError && (
                <Button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.reload()
                  }}
                  className="w-full"
                  variant="default"
                >
                  Cerrar Sesión y Continuar
                </Button>
              )}
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
                variant={isWrongEmailError ? "outline" : "default"}
              >
                Ir a Iniciar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>¡Casi listo! Crea tu cuenta</CardTitle>
            <CardDescription>
              Estás invitado a unirte a la organización con el correo: <strong>{invitationEmail}</strong>.
              Crea tu cuenta para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUpAndAccept} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Tu nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Crea una contraseña segura"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Procesando...' : 'Crear Cuenta y Unirse'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null // No se muestra nada si el usuario ya está logueado y la invitación se procesó
}

export default function AcceptInvitationPageWrapper() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <AcceptInvitationComponent />
    </Suspense>
  )
}