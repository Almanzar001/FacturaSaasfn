import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Verificar que el usuario tenga permisos para acceder a configuraciones
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'vendedor'
  
  // Solo propietarios y administradores pueden acceder a configuraciones
  if (userRole !== 'propietario' && userRole !== 'administrador') {
    redirect('/dashboard')
  }

  return <SettingsClient user={user} />
}
