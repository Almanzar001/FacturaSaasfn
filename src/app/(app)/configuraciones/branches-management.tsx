'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Building2, MapPin, Phone, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

interface Branch {
  id: string
  organization_id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
  is_main: boolean | null
  is_active: boolean | null
  created_at: string
  updated_at: string
}

interface BranchesManagementProps {
  organizationId: string
  userRole: string
}

export default function BranchesManagement({ organizationId, userRole }: BranchesManagementProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    is_active: true
  })

  const supabase = createClient()
  const canManage = userRole === 'propietario' || userRole === 'administrador'

  useEffect(() => {
    fetchBranches()
  }, [organizationId])

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .order('is_main', { ascending: false })
        .order('name')

      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      alert('Error al cargar las sucursales')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canManage) {
      alert('No tienes permisos para realizar esta acción')
      return
    }

    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update({
            name: formData.name,
            code: formData.code.toUpperCase(),
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
            is_active: formData.is_active
          })
          .eq('id', editingBranch.id)
        
        if (error) throw error
        alert('Sucursal actualizada exitosamente')
      } else {
        const { error } = await supabase
          .from('branches')
          .insert({
            organization_id: organizationId,
            name: formData.name,
            code: formData.code.toUpperCase(),
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null,
            is_active: formData.is_active,
            is_main: false
          })
        
        if (error) throw error
        alert('Sucursal creada exitosamente')
      }

      closeModal()
      await fetchBranches()
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        alert('El código de sucursal ya existe')
      } else {
        alert('Error al guardar la sucursal: ' + (error.message || 'Error desconocido'))
      }
    }
  }

  const handleDelete = async (branch: Branch) => {
    if (!canManage) {
      alert('No tienes permisos para realizar esta acción')
      return
    }

    if (branch.is_main) {
      alert('No se puede eliminar la sucursal principal')
      return
    }

    if (confirm(`¿Estás seguro de eliminar la sucursal "${branch.name}"?`)) {
      try {
        const { error } = await supabase
          .from('branches')
          .delete()
          .eq('id', branch.id)
        
        if (error) throw error
        alert('Sucursal eliminada exitosamente')
        await fetchBranches()
      } catch (error: any) {
        alert('Error al eliminar la sucursal: ' + (error.message || 'Error desconocido'))
      }
    }
  }

  const toggleStatus = async (branch: Branch) => {
    if (!canManage) {
      alert('No tienes permisos para realizar esta acción')
      return
    }

    if (branch.is_main && branch.is_active) {
      alert('No se puede desactivar la sucursal principal')
      return
    }

    try {
      const { error } = await supabase
        .from('branches')
        .update({ is_active: !branch.is_active })
        .eq('id', branch.id)
      
      if (error) throw error
      await fetchBranches()
    } catch (error: any) {
      alert('Error al cambiar el estado: ' + (error.message || 'Error desconocido'))
    }
  }

  const openModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch)
      setFormData({
        name: branch.name,
        code: branch.code,
        address: branch.address || '',
        phone: branch.phone || '',
        email: branch.email || '',
        is_active: branch.is_active || false
      })
    } else {
      setEditingBranch(null)
      setFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        is_active: true
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingBranch(null)
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      is_active: true
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Gestión de Sucursales
              </CardTitle>
              <CardDescription>
                Administra las sucursales de tu organización
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => openModal()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Sucursal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <div key={branch.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg">{branch.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={branch.is_main ? "default" : "secondary"}>
                        {branch.code}
                      </Badge>
                      {branch.is_main && (
                        <Badge variant="outline" className="text-xs">
                          Principal
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={branch.is_active || false}
                      onCheckedChange={() => toggleStatus(branch)}
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {branch.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openModal(branch)}
                      className="p-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!branch.is_main && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(branch)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {branches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay sucursales configuradas</p>
              {canManage && (
                <Button 
                  onClick={() => openModal()} 
                  className="mt-4"
                  variant="outline"
                >
                  Crear primera sucursal
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                  <Input 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="Nombre de la sucursal"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código *</label>
                  <Input 
                    name="code" 
                    value={formData.code} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="Código único (ej: SUC001)"
                    maxLength={10}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dirección</label>
                  <Input 
                    name="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    placeholder="Dirección completa"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <Input 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleInputChange} 
                    placeholder="Número de teléfono"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Input 
                    type="email"
                    name="email" 
                    value={formData.email} 
                    onChange={handleInputChange} 
                    placeholder="correo@empresa.com"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Sucursal Activa</label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingBranch ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}