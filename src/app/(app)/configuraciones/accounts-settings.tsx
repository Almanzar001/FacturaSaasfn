'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Account {
  id: string
  name: string
  type: string
  balance: number
  is_default: boolean
}

interface AccountsSettingsProps {
  organizationId: string
}

export default function AccountsSettings({ organizationId }: AccountsSettingsProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    type: '',
    balance: 0,
  })

  const supabase = createClient()

  useEffect(() => {
    if (organizationId) {
      fetchAccounts()
    }
  }, [organizationId])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      alert('Error al cargar las cuentas.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setAccountFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update({
            name: accountFormData.name,
            type: accountFormData.type,
            balance: accountFormData.balance,
          })
          .eq('id', editingAccount.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert({ ...accountFormData, organization_id: organizationId })
        if (error) throw error
      }

      closeModal()
      fetchAccounts()
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.'
     alert(`Error al guardar la cuenta: ${errorMessage}`)
   }
  }

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account)
      setAccountFormData({
        name: account.name,
        type: account.type,
        balance: account.balance,
      })
    } else {
      setEditingAccount(null)
      setAccountFormData({ name: '', type: '', balance: 0 })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAccount(null)
    setAccountFormData({ name: '', type: '', balance: 0 })
  }

  const deleteAccount = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta cuenta?')) {
      try {
        await supabase.from('accounts').delete().eq('id', id)
        fetchAccounts()
      } catch (error) {
        alert('Error al eliminar la cuenta.')
      }
    }
  }

  const setDefaultAccount = async (id: string) => {
    try {
      // First, unset any other default account
      await supabase
        .from('accounts')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('is_default', true)

      // Then, set the new default account
      await supabase
        .from('accounts')
        .update({ is_default: true })
        .eq('id', id)

      fetchAccounts()
    } catch (error) {
      alert('Error al establecer la cuenta por defecto.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>
              Gestiona las cuentas de tu organización (Caja chica, cuentas bancarias, etc.).
            </CardDescription>
          </div>
          <Button onClick={() => openModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Cuenta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">{account.name} {account.is_default && <Badge>Default</Badge>}</h4>
                <p className="text-sm text-muted-foreground">{account.type}</p>
                <p className="text-sm">Balance: ${account.balance.toFixed(2)}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => setDefaultAccount(account.id)} disabled={account.is_default}>
                  Poner por defecto
                </Button>
                <Button variant="ghost" size="icon" className="p-1 h-8 w-8" onClick={() => openModal(account)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-red-500" onClick={() => deleteAccount(account.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-lg font-medium">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
              <div>
                <label>Nombre</label>
                <Input name="name" value={accountFormData.name} onChange={handleInputChange} required />
              </div>
              <div>
                <label>Tipo</label>
                <Input name="type" value={accountFormData.type} onChange={handleInputChange} required placeholder="Ej: Caja chica, Banco" />
              </div>
              <div>
                <label>Balance Inicial</label>
                <Input type="number" name="balance" value={accountFormData.balance} onChange={handleInputChange} required disabled={!!editingAccount} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button type="submit">{editingAccount ? 'Actualizar' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  )
}