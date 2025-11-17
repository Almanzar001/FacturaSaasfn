'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Building2, AlertTriangle } from 'lucide-react'

interface User {
  id: string
  full_name: string
  email: string
  role: string
  organization_id: string
}

interface Branch {
  id: string
  name: string
  code: string
  is_main: boolean
}

interface UserBranchAssignment {
  user_id: string
  full_name: string
  email: string
  role: string
  branch_id: string | null
  branch_name: string | null
  branch_code: string | null
  is_main_branch: boolean | null
  assignment_active: boolean | null
}

const ROLE_COLORS = {
  propietario: 'bg-purple-100 text-purple-800',
  administrador: 'bg-red-100 text-red-800',
  gerente_sucursal: 'bg-blue-100 text-blue-800',
  vendedor: 'bg-green-100 text-green-800',
  contador: 'bg-yellow-100 text-yellow-800',
  inventarista: 'bg-orange-100 text-orange-800'
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [userAssignments, setUserAssignments] = useState<UserBranchAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [hasManageUsersPermission, setHasManageUsersPermission] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkPermissionsAndFetchData()
  }, [])

  const checkPermissionsAndFetchData = async () => {
    try {
      setLoading(true)

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return

      setCurrentUser(user)

      // Verificar si tiene permisos y obtener organización
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) {
        console.error('Usuario sin organización')
        return
      }

      const userRole = profile?.role
      const canManage = userRole === 'propietario' || userRole === 'administrador'
      setHasManageUsersPermission(canManage)
      setOrganizationId(profile.organization_id)

      if (canManage) {
        await fetchData(profile.organization_id)
      }
    } catch (error) {
      console.error('Error checking permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (organizationId: string) => {
    try {
      // Obtener usuarios SOLO de la organización actual
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, organization_id')
        .eq('organization_id', organizationId)
        .order('full_name')

      if (usersError) throw usersError

      // Obtener sucursales SOLO de la organización actual
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, code, is_main')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_main', { ascending: false })
        .order('name')

      if (branchesError) throw branchesError

      // Intentar obtener asignaciones de usuarios de diferentes fuentes
      let assignmentsData = []
      
      // Opción 1: Intentar desde la vista user_branch_permissions
      try {
        const { data: viewData, error: viewError } = await supabase
          .from('user_branch_permissions')
          .select('*')
        
        if (!viewError && viewData) {
          assignmentsData = viewData
        } else {
          throw viewError
        }
      } catch (viewError) {
        console.log('Vista user_branch_permissions no disponible, intentando consulta directa...')
        
        // Opción 2: Consulta directa a user_branch_assignments
        try {
          const { data: directData, error: directError } = await supabase
            .from('user_branch_assignments')
            .select(`
              user_id,
              branch_id,
              is_active,
              assigned_at,
              profiles!inner(full_name, email, role, organization_id),
              branches!inner(name, code, is_main)
            `)
            .eq('is_active', true)
            .eq('organization_id', organizationId)

          if (!directError && directData) {
            // Transformar datos para que coincidan con la interfaz
            assignmentsData = directData.map((item: any) => ({
              user_id: item.user_id,
              full_name: item.profiles?.full_name,
              email: item.profiles?.email,
              role: item.profiles?.role,
              branch_id: item.branch_id,
              branch_name: item.branches?.name,
              branch_code: item.branches?.code,
              is_main_branch: item.branches?.is_main,
              assignment_active: item.is_active,
              assigned_at: item.assigned_at
            }))
          }
        } catch (directError) {
          console.log('No se pueden obtener asignaciones de usuarios:', directError)
          assignmentsData = []
        }
      }

      setUsers(usersData || [])
      setBranches(branchesData || [])
      setUserAssignments(assignmentsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Error al cargar datos de usuarios')
    }
  }

  const assignUserToBranch = async (userId: string, branchId: string) => {
    try {
      const { error } = await supabase
        .rpc('assign_user_to_branch', {
          user_uuid: userId,
          branch_uuid: branchId
        })

      if (error) throw error

      alert('Usuario asignado a sucursal correctamente')
      if (organizationId) await fetchData(organizationId)
    } catch (error) {
      console.error('Error assigning user to branch:', error)
      alert('Error al asignar usuario a sucursal')
    }
  }

  const removeUserFromBranch = async (userId: string, branchId: string) => {
    try {
      const { error } = await supabase
        .rpc('remove_user_from_branch', {
          user_uuid: userId,
          branch_uuid: branchId
        })

      if (error) throw error

      alert('Usuario removido de sucursal correctamente')
      if (organizationId) await fetchData(organizationId)
    } catch (error) {
      console.error('Error removing user from branch:', error)
      alert('Error al remover usuario de sucursal')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!hasManageUsersPermission) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex items-center space-x-4 p-6">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Acceso Restringido
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              No tienes permisos para gestionar usuarios.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden sm:inline">Gestión de Usuarios y Sucursales</span>
          <span className="sm:hidden">Usuarios y Sucursales</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Lista de Usuarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios del Sistema ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => {
                const userBranches = userAssignments
                  .filter(ua => ua.user_id === user.id && ua.assignment_active)
                  .map(ua => ua.branch_name)
                  .filter(Boolean)

                return (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{user.full_name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{user.email}</p>
                      <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                        <Badge 
                          className={`text-xs ${ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {user.role}
                        </Badge>
                        {userBranches.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {userBranches.map((branchName, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {branchName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Select onValueChange={(branchId) => assignUserToBranch(user.id, branchId)}>
                        <SelectTrigger className="w-full sm:w-32 text-xs sm:text-sm">
                          <SelectValue placeholder="Asignar a..." />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Sucursales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sucursales ({branches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {branches.map((branch) => {
                const branchUsers = userAssignments
                  .filter(ua => ua.branch_id === branch.id && ua.assignment_active)

                return (
                  <div
                    key={branch.id}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          {branch.name}
                          {branch.is_main && (
                            <Badge variant="secondary" className="text-xs">
                              Principal
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">Código: {branch.code}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm font-medium text-gray-700">
                        Usuarios asignados ({branchUsers.length}):
                      </p>
                      {branchUsers.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-500">No hay usuarios asignados</p>
                      ) : (
                        <div className="space-y-1">
                          {branchUsers.map((assignment) => (
                            <div
                              key={`${assignment.user_id}-${branch.id}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm p-2 bg-gray-50 rounded gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="font-medium truncate block">{assignment.full_name}</span>
                                <Badge 
                                  size="sm" 
                                  className={`text-xs ${ROLE_COLORS[assignment.role as keyof typeof ROLE_COLORS] || 'bg-gray-100 text-gray-800'}`}
                                >
                                  {assignment.role}
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeUserFromBranch(assignment.user_id, branch.id)}
                                className="text-red-600 hover:text-red-700 text-xs px-2 py-1 w-full sm:w-auto"
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}