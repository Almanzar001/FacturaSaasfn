'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // La sesión se ha recuperado, el usuario puede establecer una nueva contraseña.
      }
    })
    
    // Comprobar si el usuario ya está en una sesión de recuperación
    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setError("No has iniciado una recuperación de contraseña. Si olvidaste tu contraseña, solicítala desde la página de inicio de sesión.");
        }
        setSessionChecked(true);
    }
    checkSession();

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage('¡Tu contraseña ha sido actualizada con éxito! Serás redirigido en unos segundos.')
      setTimeout(() => router.push('/dashboard'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }
  
  if (!sessionChecked) {
      return (
          <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
          </div>
      )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Actualizar Contraseña</CardTitle>
          <CardDescription>
            {error 
              ? 'Ha ocurrido un error'
              : message 
              ? 'Proceso completado'
              : 'Crea tu nueva contraseña para acceder a tu cuenta.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : message ? (
            <p className="text-green-500">{message}</p>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Introduce tu nueva contraseña"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}