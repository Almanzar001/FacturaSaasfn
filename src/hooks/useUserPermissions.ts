import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UserPermission {
  permission_key: string
  permission_name: string
  module: string
  assigned_branches: string[]
}

export interface UserBranch {
  branch_id: string
  branch_name: string
  branch_code: string
  is_main: boolean
  organization_id: string
}

export function useUserPermissions() {
  const [user, setUser] = useState<any>(null)
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [assignedBranches, setAssignedBranches] = useState<UserBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPermissions = async () => {
    try {
      // Obtener usuario actual
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser?.id) return
      
      setUser(currentUser)

    try {
      setLoading(true)
      setError(null)

      // Obtener permisos del usuario
      const { data: userPermissions, error: permError } = await supabase
        .rpc('get_user_permissions', { user_uuid: currentUser.id })

      if (permError) throw permError

      // Obtener sucursales asignadas
      const { data: userBranches, error: branchError } = await supabase
        .rpc('get_user_assigned_branches', { user_uuid: currentUser.id })

      if (branchError) throw branchError

      setPermissions(userPermissions || [])
      setAssignedBranches(userBranches || [])
    } catch (err) {
      console.error('Error fetching permissions:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
    } catch (err) {
      console.error('Error getting user:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [])

  // Función para verificar si el usuario tiene un permiso específico
  const hasPermission = (permissionKey: string): boolean => {
    return permissions.some(p => 
      p.permission_key === permissionKey || p.permission_key === 'all_permissions'
    )
  }

  // Función para verificar si puede acceder a una sucursal
  const canAccessBranch = async (branchId: string): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { data, error } = await supabase
        .rpc('user_can_access_branch', { 
          user_uuid: user.id, 
          branch_uuid: branchId 
        })

      if (error) throw error
      return data || false
    } catch (err) {
      console.error('Error checking branch access:', err)
      return false
    }
  }

  // Obtener permisos por módulo
  const getPermissionsByModule = (module: string): UserPermission[] => {
    return permissions.filter(p => p.module === module || p.module === 'all')
  }

  return {
    permissions,
    assignedBranches,
    loading,
    error,
    hasPermission,
    canAccessBranch,
    getPermissionsByModule,
    refetch: fetchPermissions
  }
}