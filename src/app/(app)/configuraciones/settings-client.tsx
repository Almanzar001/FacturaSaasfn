'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import TeamMembers from './team-members'
import AccountsSettings from './accounts-settings'

interface SettingsClientProps {
  user: SupabaseUser
}

interface Organization {
  id: string
  name: string
  logo_url: string | null
  digital_signature_url: string | null
  settings: {
    rnc?: string
    address?: string
    phone?: string
    email?: string
    pdf_footer_message?: string
  }
}

interface DocumentType {
  id: string
  name: string
  code: string
  description: string
  prefix: string
  sequence_next_value: number
  is_active: boolean
  organization_id: string
}

interface TeamMember {
  id: string
  full_name: string | null
  email: string | undefined
  role: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
  is_default: boolean
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState('organization')
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState<DocumentType | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    rnc: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    digital_signature_url: '',
    pdf_footer_message: ''
  })

  const [docTypeFormData, setDocTypeFormData] = useState({
    name: '',
    code: '',
    description: '',
    prefix: '',
    sequence_next_value: 1
  })

  const supabase = createClient()

  useEffect(() => {
    fetchOrganizationAndTypes()
  }, [])

  const fetchOrganizationAndTypes = async () => {
    setLoading(true)
    try {
      let profile = null
      // Retry logic to handle potential delay in trigger execution
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('profiles')
          .select('organization_id, role')
          .eq('id', user.id)
          .single()
        
        if (data?.organization_id) {
          profile = data
          break
        }
        await new Promise(res => setTimeout(res, 300)) // Wait 300ms before retrying
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        setUserRole(profile.role || '')
        await Promise.all([
          fetchOrganizationDetails(profile.organization_id),
          fetchDocumentTypes(profile.organization_id),
          fetchTeamData(profile.organization_id),
          fetchAccounts(profile.organization_id),
        ])
      } else {
        alert("No se pudo cargar la información de su organización. Por favor, recargue la página o contacte a soporte si el problema persiste.")
      }
    } catch (error) {
      alert('Ocurrió un error al cargar sus datos. Por favor, intente de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const fetchOrganizationDetails = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()
      
      if (error) throw error
      
      setOrganization(data)
      setOrgFormData({
        name: data.name || '',
        rnc: data.settings?.rnc || '',
        address: data.settings?.address || '',
        phone: data.settings?.phone || '',
        email: data.settings?.email || '',
        logo_url: data.logo_url || '',
        digital_signature_url: data.digital_signature_url || '',
        pdf_footer_message: data.settings?.pdf_footer_message || 'Gracias por su negocio.'
      })
    } catch (error) {
    }
  }

  const fetchDocumentTypes = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setDocumentTypes(data || [])
    } catch (error) {
    }
  }

  const fetchTeamData = async (orgId: string) => {
    try {
      
      const { data, error } = await supabase.rpc('get_team_data', {
        p_organization_id: orgId,
      })


      if (error) throw error

      // The RPC function returns an array with one object containing members and invitations
      if (data && data.length > 0) {
        const teamData = data[0]
        setTeamMembers(teamData.members || [])
        setInvitations(teamData.invitations || [])
      } else {
        setTeamMembers([])
        setInvitations([])
      }
    } catch (error) {
      setTeamMembers([])
      setInvitations([])
    }
  }

  const fetchAccounts = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      alert('Error al cargar las cuentas.')
    }
  }


  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return

    try {
      const { name, logo_url, digital_signature_url, ...settings } = orgFormData
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .update({ name, settings })
        .eq('id', organizationId)
        .select()
        .single()
      
      if (orgError) throw orgError

      // After successfully saving the organization, check if onboarding needs to be marked as complete.
      if (!organization?.settings?.rnc) { // A simple check to see if it's likely the first time
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id)
        
        if (profileError) throw profileError
      }

      alert('Organización actualizada con éxito')
      await fetchOrganizationDetails(organizationId)
    } catch (error) {
      alert('Error al actualizar la organización')
    }
  }




  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !organizationId) {
      return
    }

    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${organizationId}/${Math.random()}.${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', organizationId)

      setOrgFormData(prev => ({ ...prev, logo_url: publicUrl }))
      alert('Logo subido con éxito')
    } catch (error) {
      alert('Error al subir el logo')
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !organizationId) {
      return
    }

    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${organizationId}/${Math.random()}.${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      await supabase
        .from('organizations')
        .update({ digital_signature_url: publicUrl })
        .eq('id', organizationId)

      setOrgFormData(prev => ({ ...prev, digital_signature_url: publicUrl }))
      alert('Firma digital subida con éxito')
    } catch (error) {
      alert('Error al subir la firma digital')
    }
  }

  const handleDocTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return

    try {
      if (editingType) {
        const { error } = await supabase
          .from('document_types')
          .update({
            name: docTypeFormData.name,
            code: docTypeFormData.code,
            description: docTypeFormData.description,
            prefix: docTypeFormData.prefix,
            sequence_next_value: docTypeFormData.sequence_next_value
          })
          .eq('id', editingType.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('document_types')
          .insert({ ...docTypeFormData, organization_id: organizationId, is_active: true })
        if (error) throw error
      }

      setShowModal(false)
      setEditingType(null)
      setDocTypeFormData({ name: '', code: '', description: '', prefix: '', sequence_next_value: 1 })
      await fetchDocumentTypes(organizationId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al guardar el tipo de comprobante: ${errorMessage}`)
    }
  }

  const handleOrgInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setOrgFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDocTypeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setDocTypeFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }))
  }

  const toggleStatus = async (id: string, is_active: boolean) => {
    if (!organizationId) return
    try {
      await supabase
        .from('document_types')
        .update({ is_active: !is_active })
        .eq('id', id)
      await fetchDocumentTypes(organizationId)
    } catch (error) {
    }
  }

  const deleteType = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este tipo de comprobante?')) {
      if (!organizationId) return
      try {
        await supabase
          .from('document_types')
          .delete()
          .eq('id', id)
        await fetchDocumentTypes(organizationId)
      } catch (error) {
      }
    }
  }

  const openModal = (type?: DocumentType) => {
    if (type) {
      setEditingType(type)
      setDocTypeFormData({
        name: type.name,
        code: type.code,
        description: type.description,
        prefix: type.prefix,
        sequence_next_value: type.sequence_next_value
      })
    } else {
      setEditingType(null)
      setDocTypeFormData({ name: '', code: '', description: '', prefix: '', sequence_next_value: 1 })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingType(null)
    setDocTypeFormData({ name: '', code: '', description: '', prefix: '', sequence_next_value: 1 })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configuraciones</h1>
            <p className="text-muted-foreground">
              Gestiona los datos de tu organización, miembros del equipo y tipos de comprobantes.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="organization">Organización</TabsTrigger>
            <TabsTrigger value="team">Equipo</TabsTrigger>
            <TabsTrigger value="documentTypes">Tipos de Comprobante</TabsTrigger>
            <TabsTrigger value="accounts">Cuentas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Organización</CardTitle>
                <CardDescription>
                  Esta información aparecerá en tus facturas y cotizaciones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOrgSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                      <Input name="name" value={orgFormData.name} onChange={handleOrgInputChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">RNC</label>
                      <Input name="rnc" value={orgFormData.rnc} onChange={handleOrgInputChange} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <Input name="address" value={orgFormData.address} onChange={handleOrgInputChange} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <Input name="phone" value={orgFormData.phone} onChange={handleOrgInputChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                      <Input type="email" name="email" value={orgFormData.email} onChange={handleOrgInputChange} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mensaje de Pie de Página para PDF</label>
                    <Input name="pdf_footer_message" value={orgFormData.pdf_footer_message} onChange={handleOrgInputChange} placeholder="Ej: Gracias por su negocio." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Logotipo</label>
                    <div className="flex items-center gap-4">
                      {orgFormData.logo_url && <img src={orgFormData.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded-md border" />}
                      <Input type="file" onChange={handleLogoUpload} accept="image/*" className="max-w-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Firma Digital</label>
                    <p className="text-sm text-gray-500 mb-2">Esta firma aparecerá en la sección "Elaborado por" de los PDFs</p>
                    <div className="flex items-center gap-4">
                      {orgFormData.digital_signature_url && <img src={orgFormData.digital_signature_url} alt="Firma Digital" className="h-16 w-32 object-contain rounded-md border bg-white p-2" />}
                      <Input type="file" onChange={handleSignatureUpload} accept="image/*" className="max-w-xs" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Guardar Cambios</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="documentTypes">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Tipos de Comprobantes</CardTitle>
                    <CardDescription>
                      Configura los tipos de comprobantes que usarás en tus facturas.
                    </CardDescription>
                  </div>
                  <Button onClick={() => openModal()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documentTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{type.name}</h4>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={type.is_active ? "default" : "secondary"}>
                            {type.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                          <Badge variant="outline">{type.code}</Badge>
                          <Badge variant="outline">Prefijo: {type.prefix}</Badge>
                          <Badge variant="outline">Siguiente: {type.sequence_next_value}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(type.id, type.is_active)}>
                          {type.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-gray-500 hover:text-gray-900" onClick={() => openModal(type)} title="Editar Tipo">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteType(type.id)} title="Eliminar Tipo">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <TeamMembers
              members={teamMembers}
              invitations={invitations}
              organizationId={organizationId!}
              organizationName={organization?.name || ''}
              onTeamChange={() => fetchTeamData(organizationId!)}
              userRole={userRole}
            />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsSettings organizationId={organizationId!} />
          </TabsContent>

        </Tabs>

        {/* Modal for Document Types */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  {editingType ? 'Editar Tipo' : 'Nuevo Tipo de Comprobante'}
                </h3>
                <form onSubmit={handleDocTypeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                    <Input name="name" value={docTypeFormData.name} onChange={handleDocTypeInputChange} required placeholder="Ej: Comprobante Fiscal" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Código *</label>
                    <Input name="code" value={docTypeFormData.code} onChange={handleDocTypeInputChange} required placeholder="Ej: CF" maxLength={10} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                    <Input name="description" value={docTypeFormData.description} onChange={handleDocTypeInputChange} placeholder="Descripción del tipo de comprobante" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Prefijo *</label>
                      <Input name="prefix" value={docTypeFormData.prefix} onChange={handleDocTypeInputChange} required placeholder="Ej: B01" maxLength={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Siguiente #</label>
                      <Input type="number" name="sequence_next_value" value={docTypeFormData.sequence_next_value} onChange={handleDocTypeInputChange} required min="1" />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                    <Button type="submit">{editingType ? 'Actualizar' : 'Crear'}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
  )
}
