'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, TrendingUp, Wallet } from 'lucide-react'
import SearchInput from '@/components/ui/search-input'
import { getTodayDateString } from '@/lib/utils'

interface GeneralIncome {
  id: string
  organization_id: string
  account_id: string
  account_name: string
  description: string
  amount: number
  category: string
  income_date: string
  notes?: string | null
  created_at: string
  updated_at: string
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
  is_default: boolean
}

export default function IncomeClient() {
  const [incomes, setIncomes] = useState<GeneralIncome[]>([])
  const [filteredIncomes, setFilteredIncomes] = useState<GeneralIncome[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<GeneralIncome | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    account_id: '',
    income_date: getTodayDateString(),
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      fetchOrganization(user)
    } else {
      setLoading(false)
      setError("No se pudo obtener la información del usuario.")
    }
  }

  const fetchOrganization = async (user: SupabaseUser) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Error al buscar perfil: ${profileError.message}`)
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        await Promise.all([
          fetchIncomes(profile.organization_id),
          fetchAccounts(profile.organization_id)
        ])
      } else {
        setError('Error Crítico: Tu perfil de usuario no está vinculado a una organización.')
        setLoading(false)
      }
    } catch (error) {
      setError(`Error al cargar la organización: ${(error as any).message}`)
      setLoading(false)
    }
  }

  const fetchIncomes = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_general_income_for_organization', { org_id: orgId })

      if (error) throw error
      setIncomes(data || [])
      setFilteredIncomes(data || [])
    } catch (error) {
      setError(`Error al cargar los ingresos: ${(error as any).message}`)
    }
  }

  const fetchAccounts = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, type, balance, is_default')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setAccounts(data || [])
      
      // Si hay una cuenta por defecto, seleccionarla automáticamente
      const defaultAccount = data?.find(account => account.is_default)
      if (defaultAccount && !formData.account_id) {
        setFormData(prev => ({ ...prev, account_id: defaultAccount.id }))
      }
    } catch (error) {
      setError(`Error al cargar las cuentas: ${(error as any).message}`)
    } finally {
      setLoading(false)
    }
  }

  const filterIncomes = (query: string) => {
    if (!query.trim()) {
      setFilteredIncomes(incomes)
      return
    }

    const filtered = incomes.filter(income =>
      income.description.toLowerCase().includes(query.toLowerCase()) ||
      income.category.toLowerCase().includes(query.toLowerCase()) ||
      income.account_name.toLowerCase().includes(query.toLowerCase()) ||
      income.notes?.toLowerCase().includes(query.toLowerCase())
    )
    
    setFilteredIncomes(filtered)
  }

  useEffect(() => {
    filterIncomes(searchQuery)
  }, [searchQuery, incomes])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) {
      alert('No se ha podido identificar la organización.')
      return
    }

    try {
      if (editingIncome) {
        const { error } = await supabase.rpc('update_general_income', {
          income_id: editingIncome.id,
          p_account_id: formData.account_id,
          p_description: formData.description,
          p_amount: parseFloat(formData.amount),
          p_category: formData.category,
          p_income_date: formData.income_date,
          p_notes: formData.notes || null
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('create_general_income', {
          org_id: organizationId,
          p_account_id: formData.account_id,
          p_description: formData.description,
          p_amount: parseFloat(formData.amount),
          p_category: formData.category,
          p_income_date: formData.income_date,
          p_notes: formData.notes || null
        })
        if (error) throw error
      }

      closeModal()
      await Promise.all([
        fetchIncomes(organizationId),
        fetchAccounts(organizationId) // Refrescar cuentas para ver balances actualizados
      ])
    } catch (error) {
      alert(`Error al guardar el ingreso: ${(error as any).message}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openModal = (income?: GeneralIncome) => {
    if (income) {
      setEditingIncome(income)
      setFormData({
        description: income.description,
        amount: income.amount.toString(),
        category: income.category,
        account_id: income.account_id,
        income_date: income.income_date,
        notes: income.notes || ''
      })
    } else {
      setEditingIncome(null)
      const defaultAccount = accounts.find(account => account.is_default)
      setFormData({
        description: '',
        amount: '',
        category: '',
        account_id: defaultAccount?.id || '',
        income_date: getTodayDateString(),
        notes: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingIncome(null)
    const defaultAccount = accounts.find(account => account.is_default)
    setFormData({
      description: '',
      amount: '',
      category: '',
      account_id: defaultAccount?.id || '',
      income_date: getTodayDateString(),
      notes: ''
    })
  }

  const deleteIncome = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este ingreso? Esta acción no se puede deshacer.')) {
      try {
        if (!organizationId) return
        
        const { error } = await supabase.rpc('delete_general_income', {
          income_id: id
        })

        if (error) throw error
        await Promise.all([
          fetchIncomes(organizationId),
          fetchAccounts(organizationId) // Refrescar cuentas para ver balances actualizados
        ])
      } catch (error) {
        alert(`Error al eliminar el ingreso: ${(error as any).message}`)
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    })
  }

  const incomeCategories = [
    'Ventas de servicios', 'Consultoría', 'Comisiones', 'Intereses bancarios', 
    'Inversiones', 'Alquileres', 'Regalías', 'Subvenciones', 'Donaciones', 'Otros'
  ]

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando ingresos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 font-semibold">Error</p>
          <p className="text-red-700">{error}</p>
          <button onClick={initialize} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reintentar</button>
        </div>
      </div>
    )
  }

  const totalIncomes = incomes.reduce((sum, income) => sum + income.amount, 0)
  const totalAccountsBalance = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ingresos Generales</h1>
          <p className="text-gray-600 text-sm sm:text-base">Registra ingresos que no provienen de facturas</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Ingreso</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Total Ingresos Generales</h3>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{formatCurrency(totalIncomes)}</p>
            </div>
            <div className="text-green-400">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Saldo Total de Cuentas</h3>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">{formatCurrency(totalAccountsBalance)}</p>
            </div>
            <div className="text-blue-400">
              <Wallet className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <SearchInput
          placeholder="Buscar ingresos por descripción, categoría, cuenta o notas..."
          onSearch={handleSearch}
          className="max-w-md"
        />
      </div>

      {/* Incomes Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Ingresos</h2>
        </div>
        
        {filteredIncomes.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No se encontraron ingresos que coincidan con la búsqueda' : 'No hay ingresos registrados'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => openModal()}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 w-full sm:w-auto"
              >
                Registrar primer ingreso
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredIncomes.map((income) => (
                    <tr key={income.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(income.income_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {income.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {income.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {income.account_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                        {formatCurrency(income.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openModal(income)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                            title="Editar Ingreso"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteIncome(income.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                            title="Eliminar Ingreso"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredIncomes.map((income) => (
                <div key={income.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {income.description}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">
                        {formatDate(income.income_date)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {income.category}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {income.account_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(income.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={() => openModal(income)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                      title="Editar Ingreso"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteIncome(income.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                      title="Eliminar Ingreso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-6">{editingIncome ? 'Editar Ingreso' : 'Nuevo Ingreso'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Ingreso *</label>
                  <input 
                    type="date" 
                    name="income_date" 
                    value={formData.income_date} 
                    onChange={handleInputChange} 
                    max={getTodayDateString()}
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                  <input 
                    type="text" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Ej: Pago por servicios de consultoría" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                  <select 
                    name="category" 
                    value={formData.category} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar categoría</option>
                    {incomeCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de Destino *</label>
                  <select 
                    name="account_id" 
                    value={formData.account_id} 
                    onChange={handleInputChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {formatCurrency(account.balance)} ({account.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input 
                    type="number" 
                    name="amount" 
                    value={formData.amount} 
                    onChange={handleInputChange} 
                    required 
                    min="0" 
                    step="0.01" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea 
                    name="notes" 
                    value={formData.notes} 
                    onChange={handleInputChange} 
                    rows={3} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Notas adicionales sobre el ingreso..." 
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                  >
                    {editingIncome ? 'Actualizar Ingreso' : 'Registrar Ingreso'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}