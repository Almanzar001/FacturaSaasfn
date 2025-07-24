'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
      } else {
        router.push('/login')
      }
      setLoading(false)
    }
    getUser()
  }, [])

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !organizationName) return

    try {
      // 1. Crear la organización
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: organizationName, owner_id: user.id })
        .select()
        .single()

      if (orgError) throw orgError

      // 2. Vincular el perfil a la organización y marcar el onboarding como completado
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organization_id: org.id,
          onboarding_completed: true,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 3. Redirigir al dashboard
      router.push('/dashboard')

    } catch (error) {
      alert(`Error en el onboarding: ${(error as any).message}`)
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">¡Bienvenido!</h1>
        <p className="text-center text-gray-600">
          Para empezar, por favor dinos el nombre de tu empresa u organización.
        </p>
        <form onSubmit={handleOnboarding} className="space-y-6">
          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
              Nombre de la Organización
            </label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  )
}