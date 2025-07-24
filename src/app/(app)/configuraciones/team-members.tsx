'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Send } from 'lucide-react'

// Tipos de datos
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

interface TeamMembersProps {
  members: TeamMember[]
  invitations: Invitation[]
  organizationId: string
  organizationName: string
  onTeamChange: () => void
  userRole: string
}

export default function TeamMembers({ members, invitations, organizationId, organizationName, onTeamChange, userRole }: TeamMembersProps) {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('vendedor')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !inviteRole) {
      alert('Por favor, completa todos los campos.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data: token, error: rpcError } = await supabase.rpc('invite_user_to_organization', {
        p_organization_id: organizationId,
        p_email: inviteEmail,
        p_role: inviteRole,
      })

      if (rpcError) throw rpcError

      // Enviar el email usando la API route
      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, token, organizationName }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al enviar el correo de invitación.')
      }

      alert(`Invitación enviada exitosamente a ${inviteEmail}.`)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('vendedor')
      onTeamChange() // Refrescar la lista de miembros
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al enviar la invitación: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    // Aquí iría la lógica para llamar a una función RPC 'update_team_member_role'
    // Lógica de actualización...
    // onTeamChange()
  }

  const handleDeleteMember = async (memberId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar a este miembro del equipo?')) {
      // Aquí iría la lógica para llamar a una función RPC 'remove_team_member'
      // Lógica de eliminación...
      // onTeamChange()
    }
  }
  
  const canManageTeam = userRole === 'propietario' || userRole === 'administrador'

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Miembros del Equipo</CardTitle>
            <CardDescription>
              Gestiona quién tiene acceso a tu organización.
            </CardDescription>
          </div>
          {canManageTeam && (
            <Button onClick={() => setShowInviteModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Invitar Miembro
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lista de Miembros Actuales */}
        <div className="space-y-4">
          <h4 className="font-medium">Miembros Activos</h4>
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-semibold">{member.full_name || 'Usuario sin nombre'}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="secondary">{member.role}</Badge>
                {canManageTeam && member.role !== 'propietario' && (
                  <>
                    {/* La edición de roles se puede implementar aquí */}
                    <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-gray-500 hover:text-gray-900" onClick={() => alert('Funcionalidad de editar rol pendiente.')} title="Editar Rol">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDeleteMember(member.id)} title="Eliminar Miembro">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Lista de Invitaciones Pendientes */}
        {canManageTeam && invitations.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Invitaciones Pendientes</h4>
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div>
                  <p className="font-semibold">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">Rol invitado: {invitation.role}</p>
                </div>
                <Badge variant="outline">{invitation.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Modal para Invitar Usuario */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Invitar Nuevo Miembro</h3>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Correo Electrónico *</label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="nombre@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol *</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="administrador">Administrador</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'Enviando...' : 'Enviar Invitación'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}