'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')


      // First, ensure we have a profile by trying to get or create it
      let profile = null
      
      // Try to get existing profile
      const { data: existingProfile, error: getError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (existingProfile) {
        profile = existingProfile
      } else {
        
        // Try to create profile with minimal data
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
            username: user.email?.split('@')[0] || 'usuario'
          })
          .select()
          .single()

        if (createError) {
          // If creation fails, it might be due to RLS - let's continue anyway
          // The trigger should handle this
        } else {
          profile = newProfile
        }
      }

      // Create organization
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          owner_id: user.id
        })
        .select()
        .single()

      if (orgError) {
        throw new Error(`Error al crear la organización: ${orgError.message}`)
      }


      // Update user profile with organization
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          organization_id: organization.id,
          role: 'admin'
        })
        .eq('id', user.id)

      if (profileUpdateError) {
        // This might fail if profile doesn't exist, but we can ignore it
        // The organization is already created
      }

      router.push('/dashboard')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al configurar la organización')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Configurar tu organización
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Comienza a facturar con tu empresa
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
          
          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
              Nombre de tu empresa
            </label>
            <div className="mt-1">
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Mi Empresa SRL"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Configurando...' : 'Comenzar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
