'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { AdminOnly } from '@/components/auth/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Building, 
  Mail, 
  Shield, 
  UserPlus,
  MapPin,
  Star,
  AlertCircle
} from 'lucide-react'

interface User {
  id: string
  full_name: string | null
  email: string
  role: string
  organization_id: string
  created_at: string
  assigned_branches?: AssignedBranch[]
}

interface AssignedBranch {
  branch_id: string
  branch_name: string
  branch_code: string
  is_main: boolean
  assigned_at: string
  is_active: boolean
}

interface Branch {
  id: string
  name: string
  code: string
  is_main: boolean
  is_active: boolean
}

interface UserManagementProps {
  organizationId: string
}

const ROLES = [
  { value: 'vendedor', label: 'Vendedor', description: 'Puede crear facturas en sus sucursales asignadas' },
  { value: 'gerente_sucursal', label: 'Gerente de Sucursal', description: 'Gestiona una o más sucursales específicas' },
  { value: 'contador', label: 'Contador', description: 'Acceso a reportes financieros y gestión de pagos' },
  { value: 'inventarista', label: 'Inventarista', description: 'Gestiona inventario de productos' },
  { value: 'administrador', label: 'Administrador', description: 'Acceso completo excepto configuración de organización' }
]

export default function UserManagement({ organizationId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  
  // Estados para invitación de usuarios
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'vendedor',
    branches: [] as string[]
  })

  const { toast } = useToast()
  const { hasPermission, userRole } = usePermissions()
  const supabase = createClient()

  useEffect(() => {
    if (organizationId) {
      fetchUsers()
      fetchBranches()
    }
  }, [organizationId])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_branch_permissions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('full_name')

      if (error) throw error

      // Agrupar usuarios y sus sucursales
      const usersMap = new Map<string, User>()
      
      data.forEach((row) => {
        if (!usersMap.has(row.user_id)) {
          usersMap.set(row.user_id, {
            id: row.user_id,
            full_name: row.full_name,
            email: row.email,
            role: row.role,
            organization_id: row.organization_id,
            created_at: row.created_at || '',
            assigned_branches: []
          })
        }

        const user = usersMap.get(row.user_id)!
        if (row.branch_id && row.assignment_active) {
          user.assigned_branches!.push({
            branch_id: row.branch_id,
            branch_name: row.branch_name,
            branch_code: row.branch_code,
            is_main: row.is_main_branch,
            assigned_at: row.assigned_at,
            is_active: row.assignment_active
          })
        }
      })

      setUsers(Array.from(usersMap.values()))
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code, is_main, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const handleAssignBranches = async () => {
    if (!selectedUser) return

    try {
      // Remover asignaciones existentes
      const currentBranches = selectedUser.assigned_branches?.map(b => b.branch_id) || []
      
      for (const branchId of currentBranches) {
        if (!selectedBranches.includes(branchId)) {
          await supabase.rpc('remove_user_from_branch', {
            user_uuid: selectedUser.id,
            branch_uuid: branchId
          })
        }
      }

      // Agregar nuevas asignaciones
      for (const branchId of selectedBranches) {
        if (!currentBranches.includes(branchId)) {
          await supabase.rpc('assign_user_to_branch', {
            user_uuid: selectedUser.id,
            branch_uuid: branchId
          })
        }
      }

      toast({
        title: "Éxito",
        description: "Sucursales asignadas correctamente"
      })

      setShowAssignDialog(false)
      fetchUsers()
    } catch (error) {
      console.error('Error assigning branches:', error)
      toast({
        title: "Error",
        description: "No se pudieron asignar las sucursales",
        variant: "destructive"
      })
    }
  }

  const handleInviteUser = async () => {
    try {
      // Aquí implementarías la lógica de invitación
      // Por ahora, solo simularemos el proceso
      toast({
        title: "Invitación enviada",
        description: `Se ha enviado una invitación a ${inviteForm.email}`
      })

      setShowInviteDialog(false)
      setInviteForm({ email: '', role: 'vendedor', branches: [] })
    } catch (error) {
      console.error('Error inviting user:', error)
      toast({
        title: "Error",
        description: "No se pudo enviar la invitación",
        variant: "destructive"
      })
    }
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      propietario: { label: 'Propietario', variant: 'default' as const },
      administrador: { label: 'Administrador', variant: 'secondary' as const },
      gerente_sucursal: { label: 'Gerente', variant: 'outline' as const },
      vendedor: { label: 'Vendedor', variant: 'outline' as const },
      contador: { label: 'Contador', variant: 'outline' as const },
      inventarista: { label: 'Inventarista', variant: 'outline' as const }
    }

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.vendedor

    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    )
  }

  const openAssignDialog = (user: User) => {
    setSelectedUser(user)
    setSelectedBranches(user.assigned_branches?.map(b => b.branch_id) || [])
    setShowAssignDialog(true)
  }

  if (!hasPermission('manage_users')) {
    return (
      <div className="text-center p-8">
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Restringido</h3>
        <p className="text-gray-500">
          No tienes permisos para gestionar usuarios.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Users className="h-6 w-6" />
            <span>Gestión de Usuarios</span>
          </h2>
          <p className="text-gray-600 mt-1">
            Administra usuarios y sus asignaciones a sucursales
          </p>
        </div>
        
        <AdminOnly>
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar Usuario
          </Button>
        </AdminOnly>
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios de la Organización</CardTitle>
          <CardDescription>
            Lista de todos los usuarios y sus sucursales asignadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Cargando usuarios...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Sucursales Asignadas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.assigned_branches && user.assigned_branches.length > 0 ? (
                          user.assigned_branches.map((branch) => (
                            <div key={branch.branch_id} className="flex items-center space-x-2 text-sm">
                              <Building className="h-3 w-3 text-gray-400" />
                              <span>{branch.branch_name}</span>
                              {branch.is_main && (
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 flex items-center space-x-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>Sin sucursales asignadas</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {user.role !== 'propietario' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignDialog(user)}
                          >
                            <Building className="h-4 w-4 mr-1" />
                            Asignar Sucursales
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para asignar sucursales */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Sucursales</DialogTitle>
            <DialogDescription>
              Selecciona las sucursales a las que {selectedUser?.full_name || selectedUser?.email} tendrá acceso
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>Rol actual: {selectedUser?.role}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={branch.id}
                    checked={selectedBranches.includes(branch.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedBranches(prev => [...prev, branch.id])
                      } else {
                        setSelectedBranches(prev => prev.filter(id => id !== branch.id))
                      }
                    }}
                  />
                  <label htmlFor={branch.id} className="flex-1 flex items-center space-x-2 cursor-pointer">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span>{branch.name}</span>
                    <span className="text-xs text-gray-500">({branch.code})</span>
                    {branch.is_main && (
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignBranches}>
              Asignar Sucursales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para invitar usuario */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Envía una invitación para que un nuevo usuario se una a tu organización
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="usuario@ejemplo.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rol
              </label>
              <Select 
                value={inviteForm.role} 
                onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInviteUser} disabled={!inviteForm.email}>
              <Mail className="h-4 w-4 mr-2" />
              Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}