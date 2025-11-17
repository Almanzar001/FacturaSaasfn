import { useState, useEffect, useCallback } from 'react'
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

export interface UsePermissionsOptions {
  userId?: string
  autoRefresh?: boolean
}

export function usePermissions(options: UsePermissionsOptions = {}) {
  const { userId, autoRefresh = true } = options
  
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [assignedBranches, setAssignedBranches] = useState<UserBranch[]>([])
  const [userRole, setUserRole] = useState<string>('')
  const [organizationId, setOrganizationId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      let targetUserId = userId
      
      // Si no se proporciona userId, usar el usuario actual
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Usuario no autenticado')
        }
        targetUserId = user.id
      }
      
      // Obtener información básica del usuario
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', targetUserId)
        .single()
      
      if (profileError) throw profileError
      
      setUserRole(profile.role || '')
      setOrganizationId(profile.organization_id || '')
      
      // Obtener permisos del usuario
      const { data: userPermissions, error: permissionsError } = await supabase
        .rpc('get_user_permissions', { user_uuid: targetUserId })
      
      if (permissionsError) {
        console.warn('Error fetching permissions:', permissionsError)
        setPermissions([])
      } else {
        setPermissions(userPermissions || [])
      }
      
      // Obtener sucursales asignadas
      const { data: branches, error: branchesError } = await supabase
        .rpc('get_user_assigned_branches', { user_uuid: targetUserId })
      
      if (branchesError) {
        console.warn('Error fetching assigned branches:', branchesError)
        setAssignedBranches([])
      } else {
        setAssignedBranches(branches || [])
      }
      
    } catch (err) {
      console.error('Error fetching user permissions:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  // Funciones de utilidad para verificar permisos
  const hasPermission = useCallback((permissionKey: string): boolean => {
    if (userRole === 'propietario') return true
    return permissions.some(p => p.permission_key === permissionKey)
  }, [permissions, userRole])

  const hasModuleAccess = useCallback((module: string): boolean => {
    if (userRole === 'propietario') return true
    return permissions.some(p => p.module === module || p.module === 'all')
  }, [permissions, userRole])

  const canAccessBranch = useCallback((branchId: string): boolean => {
    if (userRole === 'propietario' || userRole === 'administrador') return true
    return assignedBranches.some(b => b.branch_id === branchId)
  }, [assignedBranches, userRole])

  const getAccessibleBranches = useCallback((): UserBranch[] => {
    if (userRole === 'propietario' || userRole === 'administrador') {
      // Para propietarios y administradores, necesitamos obtener todas las sucursales
      // Esto se manejará en el componente que usa el hook
      return assignedBranches
    }
    return assignedBranches
  }, [assignedBranches, userRole])

  const getDefaultBranch = useCallback((): UserBranch | null => {
    const mainBranch = assignedBranches.find(b => b.is_main)
    return mainBranch || assignedBranches[0] || null
  }, [assignedBranches])

  // Funciones de administración (solo para propietarios/administradores)
  const assignUserToBranch = useCallback(async (
    targetUserId: string, 
    branchId: string
  ): Promise<boolean> => {
    if (!hasPermission('manage_users')) {
      throw new Error('No tienes permisos para asignar usuarios a sucursales')
    }

    try {
      const { data, error } = await supabase
        .rpc('assign_user_to_branch', {
          user_uuid: targetUserId,
          branch_uuid: branchId
        })

      if (error) throw error
      
      if (autoRefresh) {
        await fetchUserData()
      }
      
      return true
    } catch (err) {
      console.error('Error assigning user to branch:', err)
      throw err
    }
  }, [hasPermission, supabase, autoRefresh, fetchUserData])

  const removeUserFromBranch = useCallback(async (
    targetUserId: string, 
    branchId: string
  ): Promise<boolean> => {
    if (!hasPermission('manage_users')) {
      throw new Error('No tienes permisos para remover asignaciones de sucursales')
    }

    try {
      const { data, error } = await supabase
        .rpc('remove_user_from_branch', {
          user_uuid: targetUserId,
          branch_uuid: branchId
        })

      if (error) throw error
      
      if (autoRefresh) {
        await fetchUserData()
      }
      
      return data
    } catch (err) {
      console.error('Error removing user from branch:', err)
      throw err
    }
  }, [hasPermission, supabase, autoRefresh, fetchUserData])

  return {
    permissions,
    assignedBranches,
    userRole,
    organizationId,
    loading,
    error,
    
    // Utility functions
    hasPermission,
    hasModuleAccess,
    canAccessBranch,
    getAccessibleBranches,
    getDefaultBranch,
    
    // Admin functions
    assignUserToBranch,
    removeUserFromBranch,
    
    // Refresh function
    refresh: fetchUserData
  }
}