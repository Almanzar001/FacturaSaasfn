'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { generateInvoicePdf } from '@/lib/pdfGenerator'
import { Edit, Trash2, FileText, DollarSign } from 'lucide-react'
import SearchInput from '@/components/ui/search-input'
import { getTodayDateString, getDateWithDaysAdded, refreshDashboard } from '@/lib/utils'

interface Invoice {
  id: string
  invoice_number: string
  document_type_id: string
  account_id: string | null
  client_id: string
  client_name: string
  client_email: string
  branch_id?: string | null
  subtotal: number
  discount_percentage?: number
  discount_amount?: number
  tax: number
  tax_amount?: number // For backward compatibility
  total: number
  balance?: number // Outstanding balance
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partially_paid'
  issue_date: string
  due_date: string
  notes?: string
  created_at: string
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
  }
}

interface DocumentType {
  id: string
  name: string
  prefix: string
  sequence_next_value: number
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

interface InvoiceItem {
  id?: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

interface Payment {
  id?: string
  invoice_id: string
  amount: number
  payment_date: string
  notes?: string
}

interface Account {
  id: string
  name: string
  is_default: boolean
}

interface Branch {
  id: string
  name: string
  is_main: boolean
  is_active: boolean
}

export default function InvoicesComplete() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [showInitialPayment, setShowInitialPayment] = useState(false)
  const [nextInvoiceNumberPreview, setNextInvoiceNumberPreview] = useState<string | null>(null)
  
  // Estados para crear cliente y producto
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    rnc: ''
  })
  const [newProductData, setNewProductData] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    is_inventory_tracked: false
  })
  
  const [formData, setFormData] = useState({
    client_id: '',
    branch_id: '',
    issue_date: '',
    due_date: '',
    notes: '',
    tax_rate: '18', // Default 18% tax rate for Dominican Republic
    include_tax: true,
    initial_payment: 0,
    document_type_id: '',
    account_id: '',
    apply_discount: false,
    discount_percentage: 0
  })

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0
  })

  const supabase = createClient()

  const initialize = async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      fetchOrganization(user);
      const conversionData = sessionStorage.getItem('quoteToInvoiceConversion');
      if (conversionData) {
        try {
          const parsedData = JSON.parse(conversionData);
          openModalWithQuoteData(parsedData);
        } catch (error) {
        } finally {
          sessionStorage.removeItem('quoteToInvoiceConversion');
        }
      }
    } else {
      setLoading(false);
      setError("No se pudo obtener la información del usuario.");
    }
  };

  useEffect(() => {
    initialize();
  }, [])

  useEffect(() => {
    if (formData.document_type_id && documentTypes.length > 0) {
      const selectedType = documentTypes.find(type => type.id === formData.document_type_id)
      if (selectedType) {
        const nextNumber = String(selectedType.sequence_next_value).padStart(10, '0')
        setNextInvoiceNumberPreview(`${selectedType.prefix}${nextNumber}`)
      }
    } else {
      setNextInvoiceNumberPreview(null)
    }
  }, [formData.document_type_id, documentTypes])

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

        fetchInvoices(profile.organization_id)
        fetchClients(profile.organization_id)
        fetchProducts(profile.organization_id)
        fetchDocumentTypes(profile.organization_id)
        fetchAccounts(profile.organization_id)
        fetchBranches(profile.organization_id)
      } else {
        setError('No se encontró organización')
        setLoading(false)
      }
    } catch (error) {
      setError('Error al cargar la organización')
      setLoading(false)
    }
  }

  const fetchInvoices = async (orgId: string) => {
    try {
      const { data, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (
            id,
            name,
            email
          )
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (invoicesError) throw invoicesError

      const formattedInvoices = (data || []).map((invoice: any) => ({
        ...invoice,
        client_name: invoice.clients?.name || 'Cliente sin nombre',
        client_email: invoice.clients?.email || ''
      }))

      setInvoices(formattedInvoices)
      setFilteredInvoices(formattedInvoices)
    } catch (error) {
      setError('Error al cargar las facturas')
    } finally {
      setLoading(false)
    }
  }

  // Función para filtrar facturas
  const filterInvoices = (query: string) => {
    if (!query.trim()) {
      setFilteredInvoices(invoices)
      return
    }

    const filtered = invoices.filter(invoice =>
      invoice.invoice_number.toLowerCase().includes(query.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(query.toLowerCase()) ||
      invoice.client_email.toLowerCase().includes(query.toLowerCase()) ||
      invoice.status.toLowerCase().includes(query.toLowerCase()) ||
      invoice.notes?.toLowerCase().includes(query.toLowerCase())
    )
    
    setFilteredInvoices(filtered)
  }

  // Effect para manejar la búsqueda
  useEffect(() => {
    filterInvoices(searchQuery)
  }, [searchQuery, invoices])

  // Función para manejar la búsqueda
  const handleSearch = (query: string) => {
    setSearchQuery(query)
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

  const fetchDocumentTypes = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('id, name, prefix, sequence_next_value')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setDocumentTypes(data || [])
    } catch (error) {
    }
  }

  const fetchAccounts = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, is_default')
        .eq('organization_id', orgId)
        .order('name')

      if (error) throw error
      setAccounts(data || [])
      
      const defaultAccount = data?.find(acc => acc.is_default)
      if (defaultAccount) {
        setFormData(prev => ({ ...prev, account_id: defaultAccount.id }))
      }
    } catch (error) {
      // Do not alert here, as it might be annoying for the user
    }
  }

  const fetchBranches = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, is_main, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('is_main', { ascending: false })
        .order('name')

      if (error) throw error
      setBranches(data || [])
      
      const mainBranch = data?.find(branch => branch.is_main)
      if (mainBranch) {
        setFormData(prev => ({ ...prev, branch_id: mainBranch.id }))
      }
    } catch (error) {
      // Do not alert here, as it might be annoying for the user
    }
  }

  // Funciones para crear cliente y producto
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationId || !newClientData.name.trim() || !newClientData.email.trim()) {
      alert('Nombre y email son requeridos')
      return
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          organization_id: organizationId
        })
        .select()
        .single()

      if (error) throw error

      // Actualizar la lista de clientes
      await fetchClients(organizationId)
      
      // Seleccionar automáticamente el nuevo cliente
      setFormData(prev => ({ ...prev, client_id: data.id }))
      
      // Cerrar modal y limpiar datos
      setShowCreateClient(false)
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        address: '',
        rnc: ''
      })

      // Mostrar mensaje de éxito
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      notification.textContent = 'Cliente creado exitosamente'
      document.body.appendChild(notification)
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 3000)

    } catch (error) {
      alert('Error al crear el cliente. Por favor intente de nuevo.')
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationId || !newProductData.name.trim()) {
      alert('El nombre del producto es requerido')
      return
    }

    if (newProductData.price < 0) {
      alert('El precio debe ser mayor o igual a 0')
      return
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...newProductData,
          organization_id: organizationId
        })
        .select()
        .single()

      if (error) throw error

      // Actualizar la lista de productos
      await fetchProducts(organizationId)
      
      // Seleccionar automáticamente el nuevo producto en el formulario de agregar item
      setNewItem(prev => ({
        ...prev,
        product_id: data.id,
        unit_price: newProductData.price
      }))
      
      // Cerrar modal y limpiar datos
      setShowCreateProduct(false)
      setNewProductData({
        name: '',
        description: '',
        price: 0,
        category: '',
        is_inventory_tracked: false
      })

      // Mostrar mensaje de éxito
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      notification.textContent = 'Producto creado exitosamente'
      document.body.appendChild(notification)
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 3000)

    } catch (error) {
      alert('Error al crear el producto. Por favor intente de nuevo.')
    }
  }
 
  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
    
    // Calculate discount
    const discountAmount = formData.apply_discount
      ? (subtotal * parseFloat(formData.discount_percentage.toString()) / 100)
      : 0
    
    const subtotalAfterDiscount = subtotal - discountAmount
    
    if (!formData.include_tax) {
      return {
        subtotal,
        discountAmount,
        subtotalAfterDiscount,
        tax: 0,
        total: subtotalAfterDiscount
      }
    }
    
    const taxRate = parseFloat(formData.tax_rate) / 100
    const tax = subtotalAfterDiscount * taxRate
    const total = subtotalAfterDiscount + tax
    
    return { subtotal, discountAmount, subtotalAfterDiscount, tax, total }
  }






  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationId) {
      alert('Error: No se encontró la organización')
      return
    }

    if (invoiceItems.length === 0) {
      alert('Debe agregar al menos un producto a la factura')
      return
    }
    if (!formData.account_id) {
      alert('Debe seleccionar una cuenta para la factura')
      return
    }
    if (!formData.branch_id) {
      alert('Debe seleccionar una sucursal para la factura')
      return
    }

    try {
      const { subtotal, discountAmount, subtotalAfterDiscount, tax, total } = calculateTotals()

      const invoiceData = {
        client_id: formData.client_id,
        branch_id: formData.branch_id || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes,
        subtotal,
        discount_percentage: formData.apply_discount ? parseFloat(formData.discount_percentage.toString()) : null,
        discount_amount: formData.apply_discount ? discountAmount : null,
        tax,
        tax_amount: tax, // For backward compatibility with existing schema
        total,
        balance: total, // Initial balance equals total amount
        organization_id: organizationId,
        account_id: formData.account_id || null
      }

      let invoiceId: string

      if (editingInvoice) {
        // Update existing invoice
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id)

        if (error) throw error
        invoiceId = editingInvoice.id

        // Delete existing invoice items
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId)
      } else {
        // Create new invoice
        const { data: invoiceNumberData, error: functionError } = await supabase.rpc('generate_next_invoice_number', {
          p_doc_type_id: formData.document_type_id,
          p_organization_id: organizationId
        })

        if (functionError) throw functionError

        const { data, error } = await supabase
          .from('invoices')
          .insert({
            ...invoiceData,
            document_type_id: formData.document_type_id,
            invoice_number: invoiceNumberData,
            status: 'draft'
          })
          .select()
          .single()

        if (error) throw error
        invoiceId = data.id
      }

      // Insert invoice items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoiceId,
        organization_id: organizationId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total,
        description: item.product_name
      }))

      console.log('📦 Items to insert:', itemsToInsert)
      console.log('🏢 Organization ID:', organizationId)
      console.log('📄 Invoice ID:', invoiceId)

      const { data: insertData, error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        console.error('❌ Error inserting items:', itemsError)
        console.error('📋 Error details:', JSON.stringify(itemsError, null, 2))
        throw itemsError
      }
      
      console.log('✅ Items inserted successfully:', insertData)
      

      // Handle initial payment
      if (formData.initial_payment > 0) {
        await supabase.from('payments').insert({
          invoice_id: invoiceId,
          client_id: formData.client_id,
          amount: formData.initial_payment,
          payment_date: formData.issue_date,
          organization_id: organizationId,
          account_id: formData.account_id
        })
        
        // Si el pago inicial cubre el total, marcar factura como pagada
        if (formData.initial_payment >= total) {
          await supabase
            .from('invoices')
            .update({ 
              status: 'paid',
              balance: 0
            })
            .eq('id', invoiceId)
        }
      }

      closeModal()
      fetchInvoices(organizationId)
      fetchDocumentTypes(organizationId)
      
      // Refresh dashboard to update recent activity
      setTimeout(() => refreshDashboard(), 500)
    } catch (error) {
      alert('Error al guardar la factura')
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

  const addInvoiceItem = () => {
    if (!newItem.product_id) {
      alert('Seleccione un producto')
      return
    }

    const product = products.find(p => p.id === newItem.product_id)
    if (!product) return

    const total = newItem.quantity * newItem.unit_price

    const item: InvoiceItem = {
      product_id: newItem.product_id,
      product_name: product.name,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      total
    }

    setInvoiceItems(prev => [...prev, item])
    setNewItem({ product_id: '', quantity: 1, unit_price: 0 })
    setShowAddItem(false)
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setNewItem(prev => ({
        ...prev,
        product_id: productId,
        unit_price: product.price
      }))
    }
  }

  const openModal = async (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice)
      setFormData({
        client_id: invoice.client_id,
        branch_id: invoice.branch_id || '',
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes || '',
        tax_rate: invoice.tax > 0 ? ((invoice.tax / invoice.subtotal) * 100).toFixed(0) : '18',
        include_tax: invoice.tax > 0,
        initial_payment: 0, // Not applicable when editing
        document_type_id: invoice.document_type_id || '',
        account_id: invoice.account_id || '',
        apply_discount: (invoice.discount_percentage || 0) > 0,
        discount_percentage: invoice.discount_percentage || 0
      })

      // Load invoice items
      try {
        const { data: items, error } = await supabase
          .from('invoice_items')
          .select('*, products(name)')
          .eq('invoice_id', invoice.id)

        if (error) throw error

        const formattedItems = (items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.description || item.products?.name || 'Producto eliminado',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price // Calculate total from quantity and unit_price
        }))

        setInvoiceItems(formattedItems)
      } catch (error) {
        setInvoiceItems([])
      }
    } else {
      setEditingInvoice(null)
      const today = getTodayDateString()
      const dueDate = getDateWithDaysAdded(30)
      
      setFormData({
        client_id: '',
        branch_id: branches.find(branch => branch.is_main)?.id || '',
        issue_date: today,
        due_date: dueDate,
        notes: '',
        tax_rate: '18',
        include_tax: true,
        initial_payment: 0,
        document_type_id: '',
        account_id: accounts.find(acc => acc.is_default)?.id || '',
        apply_discount: false,
        discount_percentage: 0
      })
      setInvoiceItems([])
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingInvoice(null)
    setFormData({
      client_id: '',
      branch_id: branches.find(branch => branch.is_main)?.id || '',
      issue_date: '',
      due_date: '',
      notes: '',
      tax_rate: '18',
      include_tax: true,
      initial_payment: 0,
      document_type_id: '',
      account_id: accounts.find(acc => acc.is_default)?.id || '',
      apply_discount: false,
      discount_percentage: 0
    })
    setInvoiceItems([])
    setShowAddItem(false)
    setNewItem({ product_id: '', quantity: 1, unit_price: 0 })
    setShowInitialPayment(false)
  }

  const deleteInvoice = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta factura?')) {
      try {
        if (!organizationId) return
        
        // Delete invoice items first
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id)

        // Then delete the invoice
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchInvoices(organizationId)
        
        // Refresh dashboard to update recent activity
        setTimeout(() => refreshDashboard(), 500)
      } catch (error) {
        alert('Error al eliminar la factura')
      }
    }
  }

  const openPaymentModal = async (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowPaymentModal(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('payment_date', { ascending: false })
      
      if (error) throw error
      setPayments(data || [])
    } catch (error) {
    }
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedInvoice(null)
    setPayments([])
  }

  const handleAddOrUpdatePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const amount = parseFloat(form.get('amount') as string)
    const payment_date = form.get('payment_date') as string
    const account_id = form.get('account_id') as string

    if (!selectedInvoice || !organizationId) {
      alert('Error: No se encontró la factura o la organización')
      return
    }
    if (!amount || !payment_date) {
      alert('Por favor complete el monto y la fecha de pago')
      return
    }
    if (!account_id) {
      alert('Debe seleccionar una cuenta para el pago')
      return
    }

    // Validate amount is positive
    if (amount <= 0) {
      alert('El monto debe ser mayor a cero')
      return
    }


    // Show loading state
    const submitButton = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement
    const originalText = submitButton?.textContent || ''
    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = editingPayment ? 'Actualizando...' : 'Guardando...'
    }

    try {
      let paymentResult: Payment | null = null

      if (editingPayment) {
        // Update existing payment
        const { data, error } = await supabase
          .from('payments')
          .update({ amount, payment_date })
          .eq('id', editingPayment.id)
          .select()
          .single()
        
        if (error) {
          throw new Error(`Error al actualizar el pago: ${error.message}`)
        }
        
        paymentResult = data
        setEditingPayment(null)
      } else {
        // Add new payment
        const paymentData = {
          invoice_id: selectedInvoice.id,
          client_id: selectedInvoice.client_id,
          amount,
          payment_date,
          organization_id: organizationId,
          account_id: account_id
        }

        
        const { data, error } = await supabase
          .from('payments')
          .insert(paymentData)
          .select()
          .single()
        
        if (error) {
          throw new Error(`Error al guardar el pago: ${error.message}`)
        }
        
        paymentResult = data
        
        // Immediately update the payments list with the new payment
        if (paymentResult) {
          setPayments(prev => [paymentResult as Payment, ...prev])
        }
      }
      
      // Reset form safely
      if (e.currentTarget && typeof e.currentTarget.reset === 'function') {
        e.currentTarget.reset()
      }
      
      // Wait a moment for the database trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refetch invoices to get updated balance (the trigger should have updated it)
      await fetchInvoices(organizationId)
      
      // Check if invoice is now fully paid and update status if needed
      if (selectedInvoice) {
        const { data: updatedInvoice } = await supabase
          .from('invoices')
          .select('balance, total, status')
          .eq('id', selectedInvoice.id)
          .single()
        
        if (updatedInvoice && (updatedInvoice.balance ?? 0) <= 0 && updatedInvoice.status !== 'paid') {
          await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', selectedInvoice.id)
          
          // Refetch again to show updated status
          await fetchInvoices(organizationId)
        }
      }
      
      // Refresh dashboard to update recent activity
      setTimeout(() => refreshDashboard(), 500)
      
      // If we're not editing, refetch payments to ensure we have the latest data
      if (!editingPayment && selectedInvoice) {
        const { data: updatedPayments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('invoice_id', selectedInvoice.id)
          .order('payment_date', { ascending: false })
        
        if (paymentsError) {
        } else {
          setPayments(updatedPayments || [])
        }
      }
      
      // Show success message
      const successMessage = editingPayment ? 'Pago actualizado exitosamente' : 'Pago registrado exitosamente'
      
      // Create a temporary success notification
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      notification.textContent = successMessage
      document.body.appendChild(notification)
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 3000)
      
    } catch (error) {
      
      // Show more specific error message
      let errorMessage = 'Error al guardar el pago. Por favor intente de nuevo.'
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Error: ${error.message}`
      } else if (error && typeof error === 'object' && 'details' in error) {
        errorMessage = `Error: ${(error as any).details}`
      }
      
      // Create error notification instead of alert
      const errorNotification = document.createElement('div')
      errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-md'
      errorNotification.textContent = errorMessage
      document.body.appendChild(errorNotification)
      
      // Remove error notification after 5 seconds
      setTimeout(() => {
        if (document.body.contains(errorNotification)) {
          document.body.removeChild(errorNotification)
        }
      }, 5000)
    } finally {
      // Restore button state safely
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = originalText
      }
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (confirm('¿Estás seguro de eliminar este pago?')) {
      try {
        const { error } = await supabase
          .from('payments')
          .delete()
          .eq('id', paymentId)
        
        if (error) throw error
        
        // Immediately remove the payment from the local state
        setPayments(prev => prev.filter(payment => payment.id !== paymentId))
        
        // Refetch invoices to get updated balance
        if (organizationId) {
          await fetchInvoices(organizationId)
          
          // Refresh dashboard to update recent activity
          setTimeout(() => refreshDashboard(), 500)
        }
        
        // Show success message
        const notification = document.createElement('div')
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        notification.textContent = 'Pago eliminado exitosamente'
        document.body.appendChild(notification)
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification)
          }
        }, 3000)
        
      } catch (error) {
        alert('Error al eliminar el pago. Por favor intente de nuevo.')
      }
    }
  }

  const startEditingPayment = (payment: Payment) => {
    setEditingPayment(payment)
  }

  const openModalWithQuoteData = (quoteData: any) => {
    const today = getTodayDateString();
    const dueDate = getDateWithDaysAdded(30);

    setFormData({
      client_id: quoteData.client_id,
      branch_id: branches.find(branch => branch.is_main)?.id || '',
      issue_date: today,
      due_date: dueDate,
      notes: quoteData.notes || '',
      tax_rate: '18',
      include_tax: true,
      initial_payment: 0,
      document_type_id: '',
      account_id: accounts.find(acc => acc.is_default)?.id || '',
      apply_discount: false,
      discount_percentage: 0
    });

    const itemsFromQuote = quoteData.items.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }));

    setInvoiceItems(itemsFromQuote);
    setShowModal(true);
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (!organization) {
      alert('Datos de la organización no cargados. Intente de nuevo.');
      if (organizationId) await initialize();
      return;
    }

    const client = clients.find(c => c.id === invoice.client_id);
    if (!client) {
      alert('Cliente no encontrado.');
      return;
    }

    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*, products(name)')
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      // Validate that we have items
      if (!items || items.length === 0) {
        throw new Error('No se encontraron productos en esta factura');
      }

      const formattedItems = items.map((item: any) => ({
        product_name: item.description || item.products?.name || 'Producto no encontrado',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        total: (item.quantity || 0) * (item.unit_price || 0),
      }));

      // Ensure invoice has all required fields
      const invoiceForPdf = {
        ...invoice,
        client_name: client.name,
        client_email: client.email,
        invoice_number: invoice.invoice_number || 'SIN-NUMERO',
        issue_date: invoice.issue_date || getTodayDateString(),
        due_date: invoice.due_date || getTodayDateString(),
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        total: invoice.total || 0,
      };

      await generateInvoicePdf(organization, client, invoiceForPdf, formattedItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      alert(`Error al generar el PDF: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Enviada', className: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Pagada', className: 'bg-green-100 text-green-800' },
      overdue: { label: 'Vencida', className: 'bg-red-100 text-red-800' },
      partially_paid: { label: 'Parcialmente Pagada', className: 'bg-yellow-100 text-yellow-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    if (status === 'partially_paid') {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className} flex flex-col items-center justify-center leading-tight`}>
          <span>Parcialmente</span>
          <span>Pagada</span>
        </span>
      )
    }
    
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando facturas...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={initialize}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Facturas</h1>
          <p className="text-gray-600 text-sm sm:text-base">Gestiona todas tus facturas</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nueva Factura</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg border">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Facturas</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Ventas</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total, 0))}
          </p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Recaudado</h3>
          <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">
            {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total - (inv.balance ?? inv.total)), 0))}
          </p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border">
          <h3 className="text-xs sm:text-sm font-medium text-gray-500 truncate">Balance Pendiente</h3>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600 truncate">
            {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.balance ?? inv.total), 0))}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <SearchInput
          placeholder="Buscar facturas por número, cliente, email o estado..."
          onSearch={handleSearch}
          className="max-w-md"
        />
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Facturas</h2>
        </div>
        
        {filteredInvoices.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No se encontraron facturas que coincidan con la búsqueda' : 'No hay facturas registradas'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => openModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
              >
                Crear primera factura
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.client_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(invoice.issue_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(invoice.total - (invoice.balance ?? invoice.total))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatCurrency(invoice.balance ?? invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openModal(invoice)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                            title="Editar Factura"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                            title="Eliminar Factura"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openPaymentModal(invoice)}
                            disabled={(invoice.balance ?? invoice.total) <= 0}
                            className={`p-1 rounded-full ${
                              (invoice.balance ?? invoice.total) <= 0
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-green-600 hover:text-green-900 hover:bg-green-100'
                            }`}
                            title={(invoice.balance ?? invoice.total) <= 0 ? 'Factura completamente pagada' : 'Gestionar Pagos'}
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(invoice)}
                            className="p-1 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-full"
                            title="Descargar PDF"
                          >
                            <FileText className="h-4 w-4" />
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
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {invoice.invoice_number}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{invoice.client_name}</p>
                      <p className="text-xs text-gray-500">{formatDate(invoice.issue_date)}</p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="font-medium text-gray-900 ml-1">
                        {formatCurrency(invoice.total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Pagado:</span>
                      <span className="font-medium text-green-600 ml-1">
                        {formatCurrency(invoice.total - (invoice.balance ?? invoice.total))}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Resta:</span>
                      <span className="font-medium text-red-600 ml-1">
                        {formatCurrency(invoice.balance ?? invoice.total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-1">
                    <button
                      onClick={() => openModal(invoice)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-full"
                      title="Editar Factura"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteInvoice(invoice.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                      title="Eliminar Factura"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openPaymentModal(invoice)}
                      disabled={(invoice.balance ?? invoice.total) <= 0}
                      className={`p-1 rounded-full ${
                        (invoice.balance ?? invoice.total) <= 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-green-600 hover:text-green-900 hover:bg-green-100'
                      }`}
                      title={(invoice.balance ?? invoice.total) <= 0 ? 'Factura completamente pagada' : 'Gestionar Pagos'}
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(invoice)}
                      className="p-1 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-full"
                      title="Descargar PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-6">
                {editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Client and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente *
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="client_id"
                        value={formData.client_id}
                        onChange={handleInputChange}
                        required
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar cliente</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreateClient(true)}
                        className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                        title="Crear nuevo cliente"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Comprobante *
                    </label>
                    <select
                      name="document_type_id"
                      value={formData.document_type_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar tipo</option>
                      {documentTypes.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    {nextInvoiceNumberPreview && !editingInvoice && (
                      <p className="text-sm text-gray-500 mt-1">
                        Siguiente número: {nextInvoiceNumberPreview}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de emisión *
                    </label>
                    <input
                      type="date"
                      name="issue_date"
                      value={formData.issue_date}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sucursal *
                    </label>
                    <select
                      name="branch_id"
                      value={formData.branch_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar sucursal</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} {branch.is_main ? '(Principal)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta *
                    </label>
                    <select
                      name="account_id"
                      value={formData.account_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} {account.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tax Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tasa de impuesto (%)
                    </label>
                    <input
                      type="number"
                      name="tax_rate"
                      value={formData.tax_rate}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!formData.include_tax}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <input
                      id="include_tax"
                      type="checkbox"
                      name="include_tax"
                      checked={formData.include_tax}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="include_tax" className="ml-2 block text-sm text-gray-900">
                      Incluir ITBIS
                    </label>
                  </div>
                </div>

                {/* Discount Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descuento (%)
                    </label>
                    <input
                      type="number"
                      name="discount_percentage"
                      value={formData.discount_percentage}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={!formData.apply_discount}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <input
                      id="apply_discount"
                      type="checkbox"
                      name="apply_discount"
                      checked={formData.apply_discount}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="apply_discount" className="ml-2 block text-sm text-gray-900">
                      Aplicar descuento
                    </label>
                  </div>
                </div>

                {/* Invoice Items */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Productos</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddItem(true)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      + Agregar Producto
                    </button>
                  </div>

                  {/* Add Item Form */}
                  {showAddItem && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Producto
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={newItem.product_id}
                              onChange={(e) => handleProductSelect(e.target.value)}
                              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Seleccionar producto</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} - {formatCurrency(product.price)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setShowCreateProduct(true)}
                              className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                              title="Crear nuevo producto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Precio unitario
                          </label>
                          <input
                            type="number"
                            value={newItem.unit_price}
                            onChange={(e) => setNewItem(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex items-end space-x-2">
                          <button
                            type="button"
                            onClick={addInvoiceItem}
                            className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                          >
                            Agregar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddItem(false)}
                            className="bg-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  {invoiceItems.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Producto
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Cantidad
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Precio Unit.
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Total
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {invoiceItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {item.product_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {formatCurrency(item.total)}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => removeInvoiceItem(index)}
                                  className="text-red-600 hover:text-red-900 text-sm"
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  {invoiceItems.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-medium">{formatCurrency(calculateTotals().subtotal)}</span>
                        </div>
                        {formData.apply_discount && (
                          <div className="flex justify-between text-red-600">
                            <span>Descuento ({formData.discount_percentage}%):</span>
                            <span className="font-medium">-{formatCurrency(calculateTotals().discountAmount)}</span>
                          </div>
                        )}
                        {formData.include_tax && (
                          <div className="flex justify-between">
                            <span>Impuestos ({formData.tax_rate}%):</span>
                            <span className="font-medium">{formatCurrency(calculateTotals().tax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total:</span>
                          <span>{formatCurrency(calculateTotals().total)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Initial Payment Section */}
                  {!editingInvoice && invoiceItems.length > 0 && (
                      <div className="mt-4">
                          {!showInitialPayment ? (
                              <button
                                  type="button"
                                  onClick={() => setShowInitialPayment(true)}
                                  className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                              >
                                  + Agregar Pago Inicial
                              </button>
                          ) : (
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Pago Inicial
                                  </label>
                                  <div className="flex items-center space-x-2">
                                      <input
                                          type="number"
                                          name="initial_payment"
                                          value={formData.initial_payment}
                                          onChange={handleInputChange}
                                          min="0"
                                          step="0.01"
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setShowInitialPayment(false);
                                              setFormData(prev => ({ ...prev, initial_payment: 0 }));
                                          }}
                                          className="text-red-600 hover:text-red-900 text-sm"
                                      >
                                          Cancelar
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Notas adicionales para la factura..."
                  />
                </div>

                {/* Form Actions */}
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
                    disabled={invoiceItems.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {editingInvoice ? 'Actualizar Factura' : 'Crear Factura'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingPayment ? 'Editar Pago' : `Gestionar Pagos para Factura ${selectedInvoice.invoice_number}`}
              </h3>
              
              {/* Add/Edit Payment Form */}
              <form onSubmit={handleAddOrUpdatePayment} className="mb-6 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                     <input type="number" name="amount" id="amount" required min="0.01" step="0.01" defaultValue={editingPayment?.amount} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                   </div>
                   <div>
                     <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                     <input type="date" name="payment_date" id="payment_date" required defaultValue={editingPayment?.payment_date || getTodayDateString()} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                   </div>
                   <div className="md:col-span-2">
                     <label htmlFor="account_id" className="block text-sm font-medium text-gray-700 mb-1">Cuenta *</label>
                     <select name="account_id" id="account_id" required defaultValue={accounts.find(acc => acc.is_default)?.id || ''} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                       <option value="">Seleccionar cuenta</option>
                       {accounts.map(account => (
                         <option key={account.id} value={account.id}>
                           {account.name} {account.is_default ? '(Default)' : ''}
                         </option>
                       ))}
                     </select>
                   </div>
                </div>
                <div className="flex items-end space-x-2 mt-4">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    {editingPayment ? 'Actualizar' : 'Agregar'}
                  </button>
                  {editingPayment && (
                    <button type="button" onClick={() => setEditingPayment(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              {/* Payments List */}
              <div>
                <h4 className="text-md font-medium mb-2">Historial de Pagos</h4>
                {payments.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {payments.map(payment => (
                      <li key={payment.id} className="py-2 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-gray-500">{formatDate(payment.payment_date)}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => startEditingPayment(payment)} className="text-blue-600 hover:text-blue-900">Editar</button>
                          <button onClick={() => handleDeletePayment(payment.id!)} className="text-red-600 hover:text-red-900">Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No hay pagos registrados.</p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Crear Nuevo Cliente</h3>
              
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(809) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <textarea
                    value={newClientData.address}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Dirección completa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RNC
                  </label>
                  <input
                    type="text"
                    value={newClientData.rnc}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, rnc: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123-45678-9"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateClient(false)
                      setNewClientData({
                        name: '',
                        email: '',
                        phone: '',
                        address: '',
                        rnc: ''
                      })
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Crear Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Crear Nuevo Producto</h3>
              
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={newProductData.name}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del producto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={newProductData.description}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Descripción del producto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio *
                  </label>
                  <input
                    type="number"
                    value={newProductData.price}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={newProductData.category}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Categoría del producto"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProduct(false)
                      setNewProductData({
                        name: '',
                        description: '',
                        price: 0,
                        category: '',
                        is_inventory_tracked: false
                      })
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Crear Producto
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
