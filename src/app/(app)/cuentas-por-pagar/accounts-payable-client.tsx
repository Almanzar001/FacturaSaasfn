'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, FileDown, CreditCard, Calendar, Eye, DollarSign, CheckCircle } from 'lucide-react'
import SearchInput from '@/components/ui/search-input'
import { getTodayDateString } from '@/lib/utils'

interface Provider {
  id: string
  name: string
  email: string | null
  contact_person: string | null
}

interface Account {
  id: string
  name: string
  type: string
  balance: number
  is_default: boolean
}

interface ProviderBill {
  id: string
  organization_id: string
  provider_id: string
  account_id: string | null
  bill_number: string
  reference_number: string | null
  subtotal: number
  tax: number
  total: number
  balance: number
  status: string
  due_date: string
  bill_date: string
  notes: string | null
  created_at: string
  updated_at: string
  provider?: Provider
  account?: Account
}

interface ProviderPayment {
  id: string
  organization_id: string
  provider_bill_id: string
  provider_id: string
  account_id: string | null
  amount: number
  payment_date: string
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  provider?: Provider
  account?: Account
}

export default function AccountsPayableClient() {
  const [bills, setBills] = useState<ProviderBill[]>([])
  const [filteredBills, setFilteredBills] = useState<ProviderBill[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [payments, setPayments] = useState<ProviderPayment[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showBillModal, setShowBillModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingBill, setEditingBill] = useState<ProviderBill | null>(null)
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<ProviderBill | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bills' | 'payments'>('bills')
  
  const [billFormData, setBillFormData] = useState({
    provider_id: '',
    account_id: '',
    bill_number: '',
    reference_number: '',
    subtotal: '',
    tax: '',
    total: '',
    due_date: '',
    bill_date: '',
    notes: ''
  })

  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    payment_date: '',
    payment_method: '',
    reference_number: '',
    account_id: '',
    notes: ''
  })

  const supabase = createClient()

  // Initialize dates after component mounts
  useEffect(() => {
    const today = getTodayDateString()
    setBillFormData(prev => ({ ...prev, bill_date: today }))
    setPaymentFormData(prev => ({ ...prev, payment_date: today }))
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

  useEffect(() => {
    initialize();
  }, [])

  const fetchOrganization = async (user: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (error) {
        throw error
      }

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        await Promise.all([
          fetchBills(profile.organization_id),
          fetchProviders(profile.organization_id),
          fetchAccounts(profile.organization_id),
          fetchPayments(profile.organization_id)
        ])
      } else {
        setError('No se encontró una organización para este usuario.')
        setLoading(false)
      }
    } catch (error) {
      setError(`Error al cargar la organización: ${(error as any).message || error}`)
      setLoading(false)
    }
  }

  const fetchBills = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('provider_bills')
        .select(`
          *,
          provider:providers(id, name, email, contact_person),
          account:accounts(id, name, type, balance, is_default)
        `)
        .eq('organization_id', orgId)
        .order('bill_date', { ascending: false })

      if (error) throw error
      setBills(data || [])
      setFilteredBills(data || [])
    } catch (error) {
      setError(`Error al cargar las facturas: ${(error as any).message || error}`)
    }
  }

  const fetchProviders = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('id, name, email, contact_person')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setProviders(data || [])
    } catch (error) {
      console.error('Error fetching providers:', error)
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
      
      // Si hay una cuenta por defecto, seleccionarla automáticamente
      const defaultAccount = data?.find(account => account.is_default)
      if (defaultAccount && !billFormData.account_id) {
        setBillFormData(prev => ({ ...prev, account_id: defaultAccount.id }))
        setPaymentFormData(prev => ({ ...prev, account_id: defaultAccount.id }))
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('provider_payments')
        .select(`
          *,
          provider:providers(id, name, email, contact_person),
          account:accounts(id, name, type, balance, is_default)
        `)
        .eq('organization_id', orgId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    }
  }

  const filterBills = (query: string) => {
    if (!query.trim()) {
      setFilteredBills(bills)
      return
    }

    const filtered = bills.filter(bill =>
      bill.bill_number.toLowerCase().includes(query.toLowerCase()) ||
      bill.reference_number?.toLowerCase().includes(query.toLowerCase()) ||
      bill.provider?.name?.toLowerCase().includes(query.toLowerCase()) ||
      bill.status.toLowerCase().includes(query.toLowerCase()) ||
      bill.notes?.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredBills(filtered)
  }

  useEffect(() => {
    filterBills(searchQuery)
  }, [searchQuery, bills])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const calculateTotal = () => {
    const subtotal = parseFloat(billFormData.subtotal) || 0
    const tax = parseFloat(billFormData.tax) || 0
    const total = subtotal + tax
    setBillFormData(prev => ({ ...prev, total: total.toString() }))
  }

  useEffect(() => {
    calculateTotal()
  }, [billFormData.subtotal, billFormData.tax])

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) {
      alert('No se ha podido identificar la organización.')
      return
    }

    try {
      const billData = {
        organization_id: organizationId,
        provider_id: billFormData.provider_id,
        account_id: billFormData.account_id || null,
        bill_number: billFormData.bill_number,
        reference_number: billFormData.reference_number || null,
        subtotal: parseFloat(billFormData.subtotal) || 0,
        tax: parseFloat(billFormData.tax) || 0,
        total: parseFloat(billFormData.total) || 0,
        due_date: billFormData.due_date,
        bill_date: billFormData.bill_date,
        notes: billFormData.notes || null
      }

      if (editingBill) {
        const { error } = await supabase
          .from('provider_bills')
          .update(billData)
          .eq('id', editingBill.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('provider_bills')
          .insert(billData)
        if (error) throw error
      }

      closeBillModal()
      fetchBills(organizationId)
    } catch (error) {
      alert(`Error al ${editingBill ? 'actualizar' : 'crear'} la factura.`)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId || !selectedBillForPayment) {
      alert('No se ha podido identificar la organización o la factura.')
      return
    }

    try {
      const paymentData = {
        organization_id: organizationId,
        provider_bill_id: selectedBillForPayment.id,
        provider_id: selectedBillForPayment.provider_id,
        account_id: paymentFormData.account_id || null,
        amount: parseFloat(paymentFormData.amount),
        payment_date: paymentFormData.payment_date,
        payment_method: paymentFormData.payment_method || null,
        reference_number: paymentFormData.reference_number || null,
        notes: paymentFormData.notes || null
      }

      const { error } = await supabase
        .from('provider_payments')
        .insert(paymentData)

      if (error) throw error

      closePaymentModal()
      fetchBills(organizationId)
      fetchPayments(organizationId)
    } catch (error) {
      alert('Error al registrar el pago.')
    }
  }

  const openBillModal = (bill?: ProviderBill) => {
    if (bill) {
      setEditingBill(bill)
      setBillFormData({
        provider_id: bill.provider_id,
        account_id: bill.account_id || '',
        bill_number: bill.bill_number,
        reference_number: bill.reference_number || '',
        subtotal: bill.subtotal.toString(),
        tax: bill.tax.toString(),
        total: bill.total.toString(),
        due_date: bill.due_date,
        bill_date: bill.bill_date,
        notes: bill.notes || ''
      })
    } else {
      setEditingBill(null)
      setBillFormData({
        provider_id: '',
        account_id: accounts.find(a => a.is_default)?.id || '',
        bill_number: '',
        reference_number: '',
        subtotal: '',
        tax: '',
        total: '',
        due_date: '',
        bill_date: getTodayDateString(),
        notes: ''
      })
    }
    setShowBillModal(true)
  }

  const closeBillModal = () => {
    setShowBillModal(false)
    setEditingBill(null)
  }

  const openPaymentModal = (bill: ProviderBill) => {
    setSelectedBillForPayment(bill)
    setPaymentFormData({
      amount: bill.balance.toString(),
      payment_date: getTodayDateString(),
      payment_method: '',
      reference_number: '',
      account_id: accounts.find(a => a.is_default)?.id || '',
      notes: ''
    })
    setShowPaymentModal(true)
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedBillForPayment(null)
  }

  const deleteBill = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta factura? Esta acción no se puede deshacer.')) {
      try {
        if (!organizationId) return
        
        const { error } = await supabase
          .from('provider_bills')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchBills(organizationId)
      } catch (error) {
        alert('Error al eliminar la factura.')
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  // Calcular el total por pagar (balance pendiente)
  const getTotalPending = () => {
    return bills
      .filter(bill => bill.status !== 'paid')
      .reduce((total, bill) => total + bill.balance, 0)
  }

  // Calcular el total pagado
  const getTotalPaid = () => {
    return payments.reduce((total, payment) => total + payment.amount, 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagada'
      case 'partially_paid': return 'Pagada Parcial'
      case 'overdue': return 'Vencida'
      case 'cancelled': return 'Cancelada'
      default: return 'Pendiente'
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando cuentas por pagar...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button onClick={initialize} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cuentas por Pagar</h1>
          <p className="text-gray-600 text-sm sm:text-base">Gestiona las facturas de tus proveedores</p>
        </div>
        <button
          onClick={() => openBillModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span className="sm:inline">Nueva Factura</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Por Pagar */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total por Pagar</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(getTotalPending())}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm text-gray-500">
              <span>Facturas pendientes y parciales</span>
            </div>
          </div>
        </div>

        {/* Total Pagado */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Pagado</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(getTotalPaid())}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm text-gray-500">
              <span>Suma de todos los pagos realizados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('bills')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bills'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileDown className="w-4 h-4 inline mr-2" />
              Facturas ({bills.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-2" />
              Pagos ({payments.length})
            </button>
          </nav>
        </div>

        {activeTab === 'bills' && (
          <div className="p-6">
            {/* Search */}
            <div className="mb-6">
              <SearchInput
                placeholder="Buscar facturas por número, proveedor o estado..."
                onSearch={handleSearch}
                className="max-w-md"
              />
            </div>

            {/* Bills List */}
            {filteredBills.length === 0 ? (
              <div className="text-center py-8">
                <FileDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No se encontraron facturas' : 'No hay facturas registradas'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'No se encontraron facturas que coincidan con la búsqueda' : 'No hay facturas de proveedores registradas'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => openBillModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Crear primera factura
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {bill.bill_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {bill.provider?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(bill.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(bill.balance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(bill.due_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bill.status)}`}>
                            {getStatusText(bill.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-1">
                            {bill.balance > 0 && (
                              <button
                                onClick={() => openPaymentModal(bill)}
                                className="p-1 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-full"
                                title="Realizar Pago"
                              >
                                <CreditCard className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openBillModal(bill)}
                              className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                              title="Editar Factura"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteBill(bill.id)}
                              className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                              title="Eliminar Factura"
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
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Historial de Pagos</h3>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pagos registrados</h3>
                <p className="text-gray-500">Los pagos aparecerán aquí una vez que realices pagos a las facturas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.provider?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.payment_method || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.reference_number || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-6">
                {editingBill ? 'Editar Factura' : 'Nueva Factura de Proveedor'}
              </h3>
              <form onSubmit={handleBillSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                    <select
                      required
                      value={billFormData.provider_id}
                      onChange={(e) => setBillFormData({...billFormData, provider_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar proveedor</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
                    <select
                      value={billFormData.account_id}
                      onChange={(e) => setBillFormData({...billFormData, account_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Factura *</label>
                    <input
                      type="text"
                      required
                      value={billFormData.bill_number}
                      onChange={(e) => setBillFormData({...billFormData, bill_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Referencia</label>
                    <input
                      type="text"
                      value={billFormData.reference_number}
                      onChange={(e) => setBillFormData({...billFormData, reference_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={billFormData.subtotal}
                      onChange={(e) => setBillFormData({...billFormData, subtotal: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Impuesto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={billFormData.tax}
                      onChange={(e) => setBillFormData({...billFormData, tax: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={billFormData.total}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Factura *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.bill_date}
                      onChange={(e) => setBillFormData({...billFormData, bill_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.due_date}
                      onChange={(e) => setBillFormData({...billFormData, due_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={billFormData.notes}
                    onChange={(e) => setBillFormData({...billFormData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeBillModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {editingBill ? 'Actualizar Factura' : 'Crear Factura'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBillForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Registrar Pago</h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p><strong>Factura:</strong> {selectedBillForPayment.bill_number}</p>
                <p><strong>Proveedor:</strong> {selectedBillForPayment.provider?.name}</p>
                <p><strong>Total:</strong> {formatCurrency(selectedBillForPayment.total)}</p>
                <p><strong>Balance:</strong> {formatCurrency(selectedBillForPayment.balance)}</p>
              </div>
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Pagar *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    max={selectedBillForPayment.balance}
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({...paymentFormData, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago *</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.payment_date}
                    onChange={(e) => setPaymentFormData({...paymentFormData, payment_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                  <select
                    value={paymentFormData.payment_method}
                    onChange={(e) => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar método</option>
                    <option value="cash">Efectivo</option>
                    <option value="check">Cheque</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
                  <select
                    value={paymentFormData.account_id}
                    onChange={(e) => setPaymentFormData({...paymentFormData, account_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Referencia</label>
                  <input
                    type="text"
                    value={paymentFormData.reference_number}
                    onChange={(e) => setPaymentFormData({...paymentFormData, reference_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({...paymentFormData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 w-full sm:w-auto"
                  >
                    Registrar Pago
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
