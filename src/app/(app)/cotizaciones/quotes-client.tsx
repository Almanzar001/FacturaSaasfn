'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, Trash2, FileText, Copy, Plus } from 'lucide-react'
import { generateQuotePdf } from '@/lib/pdfGenerator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Main Interfaces
interface Quote {
  id: string
  quote_number: string
  client_id: string
  client_name: string
  client_email: string
  subtotal: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  issue_date: string
  valid_until: string
  notes?: string
  created_at: string
}

interface QuoteItem {
  id?: string
  product_id: string
  product_name: string
  description?: string
  quantity: number
  unit_price: number
  total: number
}

// Supporting Interfaces (reused for consistency)
interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings: {
    rnc?: string
    address?: string
    phone?: string
    email?: string
  }
}

interface Client {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  rnc?: string
}

interface Product {
  id: string
  name: string
  description?: string
  price: number
  category?: string
}

export default function QuotesClient() {
  // Core State
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    issue_date: '',
    valid_until: '',
    notes: '',
    tax_rate: '18',
    include_tax: true,
  })
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    description: ''
  })

  const supabase = createClient()
  const router = useRouter()

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single()
        
        if (orgError) throw orgError
        setOrganization(orgData)

        fetchQuotes(profile.organization_id)
        fetchClients(profile.organization_id)
        fetchProducts(profile.organization_id)
      } else {
        setError('No se encontró organización')
        setLoading(false)
      }
    } catch (error) {
      setError('Error al cargar la organización')
      setLoading(false)
    }
  }

  const fetchQuotes = async (orgId: string) => {
    try {
      const { data, error: quotesError } = await supabase
        .from('quotes')
        .select(`*, clients (id, name, email)`)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (quotesError) throw quotesError

      const formattedQuotes = (data || []).map((quote: any) => ({
        ...quote,
        client_name: quote.clients?.name || 'Cliente sin nombre',
        client_email: quote.clients?.email || ''
      }))

      setQuotes(formattedQuotes)
    } catch (error) {
      setError('Error al cargar las cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, rnc')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
    }
  }

  const fetchProducts = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price, category')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
    }
  }

  const calculateTotals = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.total, 0)
    if (!formData.include_tax) {
      return { subtotal, tax: 0, total: subtotal }
    }
    const taxRate = parseFloat(formData.tax_rate) / 100
    const tax = subtotal * taxRate
    const total = subtotal + tax
    
    return { subtotal, tax, total }
  }

  const generateQuoteNumber = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('organization_id', orgId)
        .order('quote_number', { ascending: false })
        .limit(1)
        .single()

      // 'PGRST116' means no rows were found, which is fine for the first quote.
      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        return 'COT-00001'
      }

      const lastNumberStr = data.quote_number.split('-').pop() || '0'
      const lastNumber = parseInt(lastNumberStr, 10)
      const nextNumber = lastNumber + 1
      
      return `COT-${String(nextNumber).padStart(5, '0')}`

    } catch (err) {
      // Fallback to a random number to avoid blocking the user.
      const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
      return `COT-R${randomSuffix}`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationId) {
      alert('Error: No se encontró la organización')
      return
    }

    if (quoteItems.length === 0) {
      alert('Debe agregar al menos un producto a la cotización')
      return
    }

    try {
      const { subtotal, tax, total } = calculateTotals()

      const quoteData = {
        client_id: formData.client_id,
        issue_date: formData.issue_date,
        valid_until: formData.valid_until,
        notes: formData.notes,
        subtotal,
        tax_amount: tax,
        total,
        organization_id: organizationId
      }

      let quoteId: string

      if (editingQuote) {
        const { error } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', editingQuote.id)

        if (error) throw error
        quoteId = editingQuote.id

        await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quoteId)
      } else {
        const quote_number = await generateQuoteNumber(organizationId)
        const { data, error } = await supabase
          .from('quotes')
          .insert({ ...quoteData, quote_number, status: 'draft' })
          .select()
          .single()

        if (error) throw error
        quoteId = data.id
      }

      const itemsToInsert = quoteItems.map(item => ({
        quote_id: quoteId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total,
        description: item.description,
      }))

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      closeModal()
      fetchQuotes(organizationId)
    } catch (error) {
      alert('Error al guardar la cotización')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const addQuoteItem = () => {
    if (!newItem.product_id) {
      alert('Seleccione un producto')
      return
    }

    const product = products.find(p => p.id === newItem.product_id)
    if (!product) return

    const total = newItem.quantity * newItem.unit_price

    const item: QuoteItem = {
      product_id: newItem.product_id,
      product_name: product.name,
      description: product.description || '',
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      total
    }

    setQuoteItems(prev => [...prev, item])
    setNewItem({ product_id: '', quantity: 1, unit_price: 0, description: '' })
    setShowAddItem(false)
  }

  const removeQuoteItem = (index: number) => {
    setQuoteItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setNewItem(prev => ({
        ...prev,
        product_id: productId,
        unit_price: product.price,
        description: product.description || ''
      }))
    }
  }

  const openModal = async (quote?: Quote) => {
    if (quote) {
      setEditingQuote(quote)
      setFormData({
        client_id: quote.client_id,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        notes: quote.notes || '',
        tax_rate: quote.tax_amount > 0 ? ((quote.tax_amount / quote.subtotal) * 100).toFixed(0) : '18',
        include_tax: quote.tax_amount > 0,
      })

      try {
        const { data: items, error } = await supabase
          .from('quote_items')
          .select(`*`)
          .eq('quote_id', quote.id)

        if (error) throw error

        const formattedItems = (items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price
        }))

        setQuoteItems(formattedItems)
      } catch (error) {
        setQuoteItems([])
      }
    } else {
      setEditingQuote(null)
      const today = new Date().toISOString().split('T')[0]
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + 30)
      
      setFormData({
        client_id: '',
        issue_date: today,
        valid_until: validUntil.toISOString().split('T')[0],
        notes: '',
        tax_rate: '18',
        include_tax: true,
      })
      setQuoteItems([])
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingQuote(null)
    setFormData({
      client_id: '',
      issue_date: '',
      valid_until: '',
      notes: '',
      tax_rate: '18',
      include_tax: true,
    })
    setQuoteItems([])
    setShowAddItem(false)
    setNewItem({ product_id: '', quantity: 1, unit_price: 0, description: '' })
  }

  const deleteQuote = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta cotización?')) {
      try {
        if (!organizationId) return
        
        await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', id)

        const { error } = await supabase
          .from('quotes')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchQuotes(organizationId)
      } catch (error) {
        alert('Error al eliminar la cotización')
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Enviada', className: 'bg-blue-100 text-blue-800' },
      accepted: { label: 'Aceptada', className: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO')
  }

  const handleConvertToInvoice = async (quote: Quote) => {
    if (confirm(`¿Estás seguro de que quieres convertir la cotización ${quote.quote_number} a una factura?`)) {
      setLoading(true);
      try {
        const { data: items, error } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quote.id);

        if (error) throw error;

        const conversionData = {
          client_id: quote.client_id,
          notes: quote.notes,
          items: (items || []).map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            product_name: item.product_name,
            description: item.description,
          })),
        };

        sessionStorage.setItem('quoteToInvoiceConversion', JSON.stringify(conversionData));
        
        await supabase
          .from('quotes')
          .update({ status: 'accepted' })
          .eq('id', quote.id)

        router.push('/facturas');

      } catch (err) {
        alert('Error al convertir la cotización a factura.');
        setLoading(false);
      }
    }
  }

  const handleDownloadPdf = async (quote: Quote) => {
    if (!organization) {
      alert('Datos de la organización no cargados. Intente de nuevo.');
      if (organizationId) await initialize();
      return;
    }

    const client = clients.find(c => c.id === quote.client_id);
    if (!client) {
      alert('Cliente no encontrado.');
      return;
    }

    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);

      if (error) throw error;

      const formattedItems = (items || []).map((item: any) => ({
        product_name: item.product_name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        product_id: item.product_id,
      }));

      const quoteForPdf = {
        ...quote,
        client_name: client.name,
        client_email: client.email,
      };

      await generateQuotePdf(organization, client, quoteForPdf, formattedItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      alert(`Error al generar el PDF: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando cotizaciones...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <Button onClick={initialize} variant="destructive" className="mt-2">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-600">Gestiona todas tus cotizaciones</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Cotización
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total Cotizaciones</h3>
          <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total Cotizado</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(quotes.reduce((sum, q) => sum + q.total, 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Aceptadas</h3>
          <p className="text-2xl font-bold text-green-600">
            {quotes.filter(q => q.status === 'accepted').length}
          </p>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Cotizaciones</h2>
        </div>
        
        {quotes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No hay cotizaciones registradas</p>
            <Button onClick={() => openModal()}>
              Crear primera cotización
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quote.quote_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quote.client_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(quote.issue_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(quote.total)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(quote.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-gray-500 hover:text-gray-900" onClick={() => openModal(quote)} title="Editar Cotización">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteQuote(quote.id)} title="Eliminar Cotización">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-blue-500 hover:text-blue-700" onClick={() => handleDownloadPdf(quote)} title="Descargar PDF">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="p-1 h-8 w-8 text-green-500 hover:text-green-700" onClick={() => handleConvertToInvoice(quote)} title="Convertir a Factura">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-6">{editingQuote ? 'Editar Cotización' : 'Nueva Cotización'}</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Client and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                    <Select name="client_id" value={formData.client_id} onValueChange={(value) => handleInputChange({ target: { name: 'client_id', value } } as any)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de emisión *</label>
                    <Input type="date" name="issue_date" value={formData.issue_date} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Válida hasta *</label>
                    <Input type="date" name="valid_until" value={formData.valid_until} onChange={handleInputChange} required />
                  </div>
                </div>

                {/* Tax Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de impuesto (%)</label>
                    <Input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleInputChange} min="0" max="100" step="0.01" disabled={!formData.include_tax} />
                  </div>
                  <div className="flex items-center pt-6">
                    <Input id="include_tax" type="checkbox" name="include_tax" checked={formData.include_tax} onChange={handleInputChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="include_tax" className="ml-2 block text-sm text-gray-900">Incluir ITBIS</label>
                  </div>
                </div>

                {/* Quote Items */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Productos</h4>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddItem(true)}>+ Agregar Producto</Button>
                  </div>

                  {showAddItem && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
                          <Select value={newItem.product_id} onValueChange={handleProductSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (<SelectItem key={product.id} value={product.id}>{product.name} - {formatCurrency(product.price)}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                          <Input type="number" value={newItem.quantity} onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))} min="1" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Precio unitario</label>
                          <Input type="number" value={newItem.unit_price} onChange={(e) => setNewItem(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))} step="0.01" min="0" />
                        </div>
                        <div className="flex items-end space-x-2">
                          <Button type="button" onClick={addQuoteItem}>Agregar</Button>
                          <Button type="button" variant="outline" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {quoteItems.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {quoteItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatCurrency(item.total)}</td>
                              <td className="px-4 py-2"><Button type="button" variant="link" className="text-red-600 h-auto p-0" onClick={() => removeQuoteItem(index)}>Eliminar</Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {quoteItems.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">{formatCurrency(calculateTotals().subtotal)}</span></div>
                        {formData.include_tax && (<div className="flex justify-between"><span>Impuestos ({formData.tax_rate}%):</span><span className="font-medium">{formatCurrency(calculateTotals().tax)}</span></div>)}
                        <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(calculateTotals().total)}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <Textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} placeholder="Notas adicionales para la cotización..." />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                  <Button type="submit" disabled={quoteItems.length === 0}>{editingQuote ? 'Actualizar Cotización' : 'Crear Cotización'}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}