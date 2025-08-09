'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Calendar } from 'lucide-react'
import SearchInput from '@/components/ui/search-input'
import { getTodayDateString, refreshDashboard } from '@/lib/utils'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  expense_date: string
  receipt_url?: string | null
  notes?: string | null
  created_at: string
}

export default function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    expense_date: getTodayDateString(),
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      fetchOrganization(user);
    } else {
      setLoading(false);
      setError("No se pudo obtener la información del usuario.");
    }
  };

  const fetchOrganization = async (user: SupabaseUser) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Error al buscar perfil: ${profileError.message}`);
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        fetchExpenses(profile.organization_id)
      } else {
        setError('Error Crítico: Tu perfil de usuario no está vinculado a una organización.')
        setLoading(false)
      }
    } catch (error) {
      setError(`Error al cargar la organización: ${(error as any).message}`)
      setLoading(false)
    }
  }

  const fetchExpenses = async (orgId: string) => {
    try {
      // Llamar a la función de base de datos en lugar de a la tabla directamente
      const { data, error } = await supabase
        .rpc('get_expenses_for_organization', { org_id: orgId })

      if (error) throw error
      setExpenses(data || [])
      setFilteredExpenses(data || [])
    } catch (error) {
      setError(`Error al cargar los gastos: ${(error as any).message}`)
    } finally {
      setLoading(false)
    }
  }

  // Función para filtrar gastos
  const filterExpenses = (query: string) => {
    if (!query.trim()) {
      setFilteredExpenses(expenses)
      return
    }

    const filtered = expenses.filter(expense =>
      expense.description.toLowerCase().includes(query.toLowerCase()) ||
      expense.category.toLowerCase().includes(query.toLowerCase()) ||
      expense.notes?.toLowerCase().includes(query.toLowerCase())
    )
    
    setFilteredExpenses(filtered)
  }

  // Effect para manejar la búsqueda
  useEffect(() => {
    filterExpenses(searchQuery)
  }, [searchQuery, expenses])

  // Función para manejar la búsqueda
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
      if (editingExpense) {
        // Llamar a la función de actualización
        const { error } = await supabase.rpc('update_expense', {
          expense_id: editingExpense.id,
          p_category: formData.category,
          p_description: formData.description,
          p_amount: parseFloat(formData.amount),
          p_expense_date: formData.expense_date,
          p_notes: formData.notes || null
        })
        if (error) throw error
      } else {
        // Llamar a la función de creación
        const { error } = await supabase.rpc('create_expense', {
          org_id: organizationId,
          p_category: formData.category,
          p_description: formData.description,
          p_amount: parseFloat(formData.amount),
          p_expense_date: formData.expense_date,
          p_notes: formData.notes || null
        })
        if (error) throw error
      }

      closeModal()
      fetchExpenses(organizationId)
      
      // Refresh dashboard to update recent activity
      setTimeout(() => refreshDashboard(), 500)
    } catch (error) {
      alert(`Error al guardar el gasto: ${(error as any).message}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        category: expense.category,
        expense_date: expense.expense_date,
        notes: expense.notes || ''
      })
    } else {
      setEditingExpense(null)
      setFormData({
        description: '',
        amount: '',
        category: '',
        expense_date: getTodayDateString(),
        notes: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingExpense(null)
    setFormData({
      description: '',
      amount: '',
      category: '',
      expense_date: getTodayDateString(),
      notes: ''
    })
  }

  const deleteExpense = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.')) {
      try {
        if (!organizationId) return
        
        // Llamar a la función de eliminación
        const { error } = await supabase.rpc('delete_expense', {
          expense_id: id
        })

        if (error) throw error
        fetchExpenses(organizationId)
        
        // Refresh dashboard to update recent activity
        setTimeout(() => refreshDashboard(), 500)
      } catch (error) {
        alert(`Error al eliminar el gasto: ${(error as any).message}`)
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
    // Ajustar para la zona horaria local y evitar problemas de un día menos
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Tratar la fecha como UTC para evitar desplazamientos
    });
  }

  const expenseCategories = [
    'Oficina', 'Marketing', 'Transporte', 'Servicios', 'Suministros',
    'Tecnología', 'Alimentación', 'Viajes', 'Salarios', 'Impuestos', 'Otros'
  ]

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando gastos...</span>
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

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gastos</h1>
          <p className="text-gray-600 text-sm sm:text-base">Gestiona todos los gastos de tu organización</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo Gasto</span>
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg border p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Total de Gastos</h3>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="text-gray-400">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <SearchInput
          placeholder="Buscar gastos por descripción, categoría o notas..."
          onSearch={handleSearch}
          className="max-w-md"
        />
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Gastos</h2>
        </div>
        
        {filteredExpenses.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No se encontraron gastos que coincidan con la búsqueda' : 'No hay gastos registrados'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => openModal()}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 w-full sm:w-auto"
              >
                Registrar primer gasto
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(expense.expense_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openModal(expense)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                            title="Editar Gasto"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteExpense(expense.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                            title="Eliminar Gasto"
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
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {expense.description}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">
                        {formatDate(expense.expense_date)}
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        {expense.category}
                      </span>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <span className="text-sm font-semibold text-red-600">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={() => openModal(expense)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                      title="Editar Gasto"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                      title="Eliminar Gasto"
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
              <h3 className="text-lg font-semibold mb-6">{editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Gasto *</label>
                  <input type="date" name="expense_date" value={formData.expense_date} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                  <input type="text" name="description" value={formData.description} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Compra de suministros de oficina" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar categoría</option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Notas adicionales sobre el gasto..." />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">{editingExpense ? 'Actualizar Gasto' : 'Registrar Gasto'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}