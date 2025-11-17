'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Package, ShoppingCart, RotateCcw, ArrowUpDown, Search, Calendar, Filter, RefreshCw } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string | null
  is_inventory_tracked: boolean
}

interface Branch {
  id: string
  name: string
  is_active: boolean
}

interface Movement {
  id: string
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  reference_type: string | null
  reference_id: string | null
  cost_price: number
  notes: string | null
  movement_date: string
  product: {
    name: string
    sku: string | null
  } | {
    name: string
    sku: string | null
  }[] | null
  branch: {
    name: string
  } | {
    name: string
  }[] | null
}

interface StockItem {
  id: string
  quantity: number
  min_stock: number | null
  max_stock: number | null
  cost_price: number
  last_movement_date: string | null
  product: {
    id: string
    name: string
    sku: string | null
    unit_of_measure: string | null
  }
  branch: {
    id: string
    name: string
  }
}

interface PurchaseItem {
  product_id: string
  quantity: number
  cost_price: number
}

export default function InventoryMovements() {
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [branchSummary, setBranchSummary] = useState<any[]>([])
  
  // Estados para registro de compras
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')
  
  // Estados para movimiento manual
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  
  // Estados para transferencias
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferForm, setTransferForm] = useState({
    product_id: '',
    from_branch_id: '',
    to_branch_id: '',
    quantity: 0,
    notes: ''
  })
  const [movementForm, setMovementForm] = useState({
    product_id: '',
    branch_id: '',
    movement_type: '',
    quantity: 0,
    cost_price: 0,
    notes: ''
  })
  
  // Estados para filtros (sin search)
  const [filters, setFilters] = useState({
    branch_id: 'all',
    movement_type: 'all',
    date_from: '',
    date_to: ''
  })

  // Estado separado para búsqueda con debounce
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Debounce personalizado para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500) // 500ms delay

    return () => {
      clearTimeout(handler)
    }
  }, [searchQuery])

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadInitialData()
  }, [])

  // Cargar datos cuando cambien los filtros (sin búsqueda)
  useEffect(() => {
    loadMovements()
    loadCurrentStock()
    loadBranchSummary()
  }, [filters])

  // Cargar movimientos cuando cambie la búsqueda debounced
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) return // Evitar doble carga
    loadMovements()
  }, [debouncedSearchQuery])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      // Obtener perfil del usuario
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) throw new Error('No hay organización asociada')

      // Cargar productos con inventario habilitado
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, is_inventory_tracked')
        .eq('organization_id', profile.organization_id)
        .eq('is_inventory_tracked', true)
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Cargar sucursales activas
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, is_active')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name')

      if (branchesError) throw branchesError
      setBranches(branchesData || [])

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) return

      let query = supabase
        .from('inventory_movements')
        .select(`
          id,
          movement_type,
          quantity,
          previous_quantity,
          new_quantity,
          reference_type,
          reference_id,
          cost_price,
          notes,
          movement_date,
          product:products!inner(name, sku, organization_id),
          branch:branches!inner(name, organization_id)
        `)
        .eq('product.organization_id', profile.organization_id)
        .eq('branch.organization_id', profile.organization_id)
        .order('movement_date', { ascending: false })

      // Aplicar filtros
      if (filters.branch_id && filters.branch_id !== 'all') {
        query = query.eq('branch_id', filters.branch_id)
      }
      
      if (filters.movement_type && filters.movement_type !== 'all') {
        query = query.eq('movement_type', filters.movement_type)
      }
      
      if (filters.date_from) {
        query = query.gte('movement_date', filters.date_from)
      }
      
      if (filters.date_to) {
        query = query.lte('movement_date', filters.date_to + 'T23:59:59')
      }

      const { data: movementsData, error: movementsError } = await query
        .limit(500) // Aumentar límite para permitir filtrado

      if (movementsError) throw movementsError

      // Aplicar búsqueda en el cliente de manera eficiente
      let filteredMovements = movementsData || []
      if (debouncedSearchQuery.trim()) {
        const searchLower = debouncedSearchQuery.toLowerCase()
        filteredMovements = filteredMovements.filter(movement => {
          const product = Array.isArray(movement.product) ? movement.product[0] : movement.product
          return (
            product?.name?.toLowerCase().includes(searchLower) ||
            product?.sku?.toLowerCase().includes(searchLower) ||
            movement.notes?.toLowerCase().includes(searchLower)
          )
        })
      }

      // Limitar a 100 resultados después del filtrado
      setMovements(filteredMovements.slice(0, 100))

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error cargando movimientos: " + error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingMovements(false)
    }
  }, [filters, debouncedSearchQuery, supabase, toast])

  const loadCurrentStock = async () => {
    setLoadingStock(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) return

      let query = supabase
        .from('inventory_stock')
        .select(`
          id,
          quantity,
          min_stock,
          max_stock,
          cost_price,
          last_movement_date,
          product:products!inner(id, name, sku, unit_of_measure, organization_id),
          branch:branches!inner(id, name, organization_id)
        `)
        .eq('product.organization_id', profile.organization_id)
        .eq('branch.organization_id', profile.organization_id)
        .order('last_movement_date', { ascending: false })

      // Aplicar filtro de sucursal si está seleccionado
      if (filters.branch_id && filters.branch_id !== 'all') {
        query = query.eq('branch_id', filters.branch_id)
      }

      const { data: stockData, error: stockError } = await query

      if (stockError) throw stockError

      // Filtrar y transformar datos de stock
      const filteredStock = stockData?.filter(item => {
        const branch = Array.isArray(item.branch) ? item.branch[0] : item.branch
        return branch?.id // Solo mostrar items que tienen sucursal válida
      }).map(item => ({
        id: item.id,
        quantity: item.quantity,
        min_stock: item.min_stock,
        max_stock: item.max_stock,
        cost_price: item.cost_price,
        last_movement_date: item.last_movement_date,
        product: Array.isArray(item.product) ? item.product[0] : item.product,
        branch: Array.isArray(item.branch) ? item.branch[0] : item.branch
      })) || []

      setStockItems(filteredStock as StockItem[])

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error cargando stock: " + error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingStock(false)
    }
  }

  const loadBranchSummary = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) return

      // Resumen de stock por sucursal
      const { data: summaryData, error } = await supabase
        .from('inventory_stock')
        .select(`
          quantity,
          product:products!inner(name, organization_id),
          branch:branches!inner(id, name, organization_id)
        `)
        .eq('product.organization_id', profile.organization_id)
        .eq('branch.organization_id', profile.organization_id)

      if (error) throw error

      // Agrupar por sucursal
      const branchGroups = summaryData?.reduce((acc: any, item: any) => {
        const branch = Array.isArray(item.branch) ? item.branch[0] : item.branch
        const branchId = branch?.id
        const branchName = branch?.name

        if (!acc[branchId]) {
          acc[branchId] = {
            branchId,
            branchName,
            totalProducts: 0,
            totalQuantity: 0,
            lowStockCount: 0
          }
        }

        acc[branchId].totalProducts += 1
        acc[branchId].totalQuantity += item.quantity || 0
        if (item.quantity <= 5) acc[branchId].lowStockCount += 1

        return acc
      }, {})

      setBranchSummary(Object.values(branchGroups || {}))

    } catch (error: any) {
      console.error('Error loading branch summary:', error)
    }
  }

  const addPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { product_id: '', quantity: 0, cost_price: 0 }])
  }

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index))
  }

  const updatePurchaseItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...purchaseItems]
    updated[index] = { ...updated[index], [field]: value }
    setPurchaseItems(updated)
  }

  const registerPurchase = async () => {
    console.log('🚀 Iniciando registerPurchase...')
    console.log('📋 selectedBranch:', selectedBranch)
    console.log('📋 purchaseItems:', purchaseItems)
    
    if (!selectedBranch || purchaseItems.length === 0) {
      console.log('❌ Validación inicial fallida')
      toast({
        title: "Error",
        description: "Selecciona una sucursal y agrega al menos un producto",
        variant: "destructive",
      })
      return
    }

    // Validar items
    for (const item of purchaseItems) {
      if (!item.product_id || item.quantity <= 0 || item.cost_price < 0) {
        console.log('❌ Validación de items fallida:', item)
        toast({
          title: "Error",
          description: "Todos los productos deben tener cantidad > 0 y precio ≥ 0",
          variant: "destructive",
        })
        return
      }
    }

    console.log('✅ Validaciones pasadas, ejecutando...')
    setLoading(true)
    
    try {
      console.log('🔐 Obteniendo usuario...')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('❌ Usuario no autenticado')
        throw new Error('No autenticado')
      }
      console.log('✅ Usuario obtenido:', user.id)

      console.log('🏢 Obteniendo perfil...')
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) {
        console.log('❌ No hay organización asociada')
        throw new Error('No hay organización asociada')
      }
      console.log('✅ Organización obtenida:', profile.organization_id)

      // Preparar parámetros
      const params = {
        p_organization_id: profile.organization_id,
        p_branch_id: selectedBranch,
        p_products: purchaseItems,
        p_notes: purchaseNotes || null
      }
      console.log('📤 Parámetros para RPC:', params)

      // Llamar función de registro de compra
      console.log('🔄 Llamando register_purchase...')
      const { data, error } = await supabase.rpc('register_purchase', params)

      console.log('📥 Respuesta RPC:', { data, error })

      if (error) {
        console.log('❌ Error en RPC:', error)
        throw error
      }

      console.log('📊 Data recibida:', data)

      // La función ahora retorna un objeto JSONB directamente
      if (data?.success) {
        console.log('✅ Compra exitosa:', data)
        toast({
          title: "Éxito",
          description: `Compra registrada: ${data.movements_created} movimientos creados`,
        })
        
        // Limpiar formulario
        setPurchaseItems([])
        setSelectedBranch('')
        setPurchaseNotes('')
        setShowPurchaseDialog(false)
        
        // Recargar movimientos y stock
        loadMovements()
        loadCurrentStock()
      } else {
        console.log('❌ Compra fallida:', data)
        throw new Error(data?.message || 'Error registrando compra')
      }

    } catch (error: any) {
      console.log('🔥 Error capturado:', error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      console.log('🏁 Finalizando registerPurchase...')
      setLoading(false)
    }
  }

  const registerMovement = async () => {
    if (!movementForm.product_id || !movementForm.branch_id || !movementForm.movement_type || movementForm.quantity === 0) {
      toast({
        title: "Error",
        description: "Completa todos los campos obligatorios",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('register_inventory_movement', {
        p_product_id: movementForm.product_id,
        p_branch_id: movementForm.branch_id,
        p_movement_type: movementForm.movement_type,
        p_quantity: movementForm.movement_type === 'salida' ? -Math.abs(movementForm.quantity) : Math.abs(movementForm.quantity),
        p_reference_type: 'ajuste',
        p_reference_id: null,
        p_cost_price: movementForm.cost_price,
        p_notes: movementForm.notes || null
      })

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Movimiento registrado correctamente",
      })
      
      // Limpiar formulario
      setMovementForm({
        product_id: '',
        branch_id: '',
        movement_type: '',
        quantity: 0,
        cost_price: 0,
        notes: ''
      })
      setShowMovementDialog(false)
      
      // Recargar movimientos y stock
      loadMovements()
      loadCurrentStock()

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferForm.product_id || !transferForm.from_branch_id || !transferForm.to_branch_id || transferForm.quantity <= 0) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios",
        variant: "destructive",
      })
      return
    }

    if (transferForm.from_branch_id === transferForm.to_branch_id) {
      toast({
        title: "Error", 
        description: "No puede transferir a la misma sucursal",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) throw new Error('No hay organización asociada')

      const { error } = await supabase.rpc('transfer_inventory', {
        p_organization_id: profile.organization_id,
        p_product_id: transferForm.product_id,
        p_from_branch_id: transferForm.from_branch_id,
        p_to_branch_id: transferForm.to_branch_id,
        p_quantity: transferForm.quantity,
        p_notes: transferForm.notes || 'Transferencia desde inventario',
        p_user_id: user.id
      })

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Transferencia realizada correctamente",
      })
      
      // Limpiar formulario
      setTransferForm({
        product_id: '',
        from_branch_id: '',
        to_branch_id: '',
        quantity: 0,
        notes: ''
      })
      setShowTransferDialog(false)
      
      // Recargar datos
      loadMovements()
      loadCurrentStock()
      loadBranchSummary()

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'entrada':
        return <Badge className="bg-green-100 text-green-800">Entrada</Badge>
      case 'salida':
        return <Badge className="bg-red-100 text-red-800">Salida</Badge>
      case 'ajuste':
        return <Badge className="bg-blue-100 text-blue-800">Ajuste</Badge>
      case 'transferencia_entrada':
        return <Badge className="bg-purple-100 text-purple-800">Transfer. Entrada</Badge>
      case 'transferencia_salida':
        return <Badge className="bg-orange-100 text-orange-800">Transfer. Salida</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const formatQuantity = (type: string, quantity: number) => {
    const prefix = ['entrada', 'transferencia_entrada'].includes(type) ? '+' : 
                  ['salida', 'transferencia_salida'].includes(type) ? '-' : ''
    return `${prefix}${Math.abs(quantity)}`
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimientos de Inventario</h1>
          <p className="text-muted-foreground">
            Registra compras, ajustes y consulta el historial de movimientos
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Transferir Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir Inventario</DialogTitle>
                <DialogDescription>
                  Mover productos entre sucursales
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Producto</label>
                  <select
                    value={transferForm.product_id}
                    onChange={(e) => setTransferForm({...transferForm, product_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.sku && `(${product.sku})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Desde Sucursal</label>
                    <select
                      value={transferForm.from_branch_id}
                      onChange={(e) => setTransferForm({...transferForm, from_branch_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar sucursal origen</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Hacia Sucursal</label>
                    <select
                      value={transferForm.to_branch_id}
                      onChange={(e) => setTransferForm({...transferForm, to_branch_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar sucursal destino</option>
                      {branches.filter(b => b.id !== transferForm.from_branch_id).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={transferForm.quantity || ''}
                    onChange={(e) => setTransferForm({...transferForm, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                  <textarea
                    placeholder="Motivo de la transferencia..."
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleTransfer} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Transferir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Registrar Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Registrar Compra</DialogTitle>
                <DialogDescription>
                  Registra la entrada de productos al inventario
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch">Sucursal</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas (opcional)</Label>
                    <Input
                      id="notes"
                      placeholder="Ej: Proveedor ABC, Factura #123"
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Productos</Label>
                    <Button type="button" onClick={addPurchaseItem} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Producto
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {purchaseItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-5 gap-2 items-end">
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updatePurchaseItem(index, 'product_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} {product.sku && `(${product.sku})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          type="number"
                          placeholder="Cantidad"
                          min="0"
                          value={item.quantity || ''}
                          onChange={(e) => updatePurchaseItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        
                        <Input
                          type="number"
                          placeholder="Precio Costo"
                          min="0"
                          step="0.01"
                          value={item.cost_price || ''}
                          onChange={(e) => updatePurchaseItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                        />
                        
                        <div className="text-sm font-medium">
                          ${((item.quantity || 0) * (item.cost_price || 0)).toFixed(2)}
                        </div>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePurchaseItem(index)}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))}
                    
                    {purchaseItems.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No hay productos agregados
                      </div>
                    )}
                  </div>
                  
                  {purchaseItems.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center font-medium">
                        <span>Total:</span>
                        <span>
                          ${purchaseItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={registerPurchase} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Registrar Compra
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Movimiento Manual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Movimiento Manual</DialogTitle>
                <DialogDescription>
                  Registra entradas, salidas o ajustes manuales de inventario
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product">Producto</Label>
                    <Select value={movementForm.product_id} onValueChange={(value) => setMovementForm({...movementForm, product_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} {product.sku && `(${product.sku})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="branch">Sucursal</Label>
                    <Select value={movementForm.branch_id} onValueChange={(value) => setMovementForm({...movementForm, branch_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="movement_type">Tipo de Movimiento</Label>
                    <Select value={movementForm.movement_type} onValueChange={(value) => setMovementForm({...movementForm, movement_type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="salida">Salida</SelectItem>
                        <SelectItem value="ajuste">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={movementForm.quantity || ''}
                      onChange={(e) => setMovementForm({...movementForm, quantity: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Precio de Costo (opcional)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={movementForm.cost_price || ''}
                    onChange={(e) => setMovementForm({...movementForm, cost_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="movement_notes">Notas</Label>
                  <Textarea
                    id="movement_notes"
                    placeholder="Motivo del movimiento..."
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({...movementForm, notes: e.target.value})}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMovementDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={registerMovement} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Registrar Movimiento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Resumen por Sucursal */}
      {branchSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen por Sucursal</CardTitle>
            <CardDescription>Stock actual distribuido en cada sucursal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {branchSummary.map((summary: any) => (
                <div key={summary.branchId} className="border rounded-lg p-4 hover:bg-gray-50">
                  <h3 className="font-medium text-lg mb-2">{summary.branchName}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Productos:</span>
                      <span className="font-medium">{summary.totalProducts}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Stock Total:</span>
                      <span className="font-medium">{summary.totalQuantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Stock Bajo:</span>
                      <span className={`font-medium ${summary.lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {summary.lowStockCount}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => setFilters(prev => ({ ...prev, branch_id: summary.branchId }))}
                    >
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="movements" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="movements">Historial de Movimientos</TabsTrigger>
            <TabsTrigger value="stock">Stock Actual</TabsTrigger>
          </TabsList>
          
          {filters.branch_id !== 'all' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Filtrando por: {branches.find(b => b.id === filters.branch_id)?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, branch_id: 'all' }))}
              >
                Ver Todas las Sucursales
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Actual
              </CardTitle>
              <CardDescription>
                Consulta las existencias actuales por producto y sucursal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros para stock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="stock_search">Buscar Producto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="stock_search"
                      placeholder="Nombre o SKU del producto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stock_branch">Sucursal</Label>
                  <Select value={filters.branch_id} onValueChange={(value) => setFilters({...filters, branch_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las sucursales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sucursales</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabla de stock actual */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead className="text-right">Stock Actual</TableHead>
                      <TableHead className="text-right">Stock Mínimo</TableHead>
                      <TableHead className="text-right">Stock Máximo</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Última Actualización</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingStock ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : stockItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No hay productos en stock
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockItems
                        .filter(item => {
                          if (!debouncedSearchQuery) return true
                          const searchLower = debouncedSearchQuery.toLowerCase()
                          const product = item.product
                          return product.name.toLowerCase().includes(searchLower) ||
                                 (product.sku?.toLowerCase().includes(searchLower))
                        })
                        .map((item) => {
                          const isLowStock = item.min_stock && item.quantity <= item.min_stock
                          const isOutOfStock = item.quantity <= 0
                          const isHighStock = item.max_stock && item.quantity >= item.max_stock
                          
                          return (
                            <TableRow key={item.id} className={isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''}>
                              <TableCell>
                                <div className="font-medium">{item.product.name}</div>
                              </TableCell>
                              <TableCell>
                                <code className="text-sm">{item.product.sku || '-'}</code>
                              </TableCell>
                              <TableCell>{item.branch.name}</TableCell>
                              <TableCell className="text-right font-mono text-lg font-semibold">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.min_stock || '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.max_stock || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                ${item.cost_price.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {item.product.unit_of_measure || 'und'}
                              </TableCell>
                              <TableCell>
                                {item.last_movement_date ? 
                                  new Date(item.last_movement_date).toLocaleDateString('es-ES') : 
                                  'Sin movimientos'
                                }
                              </TableCell>
                              <TableCell>
                                {isOutOfStock ? (
                                  <Badge variant="destructive">Sin Stock</Badge>
                                ) : isLowStock ? (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Stock Bajo</Badge>
                                ) : isHighStock ? (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">Stock Alto</Badge>
                                ) : (
                                  <Badge variant="default" className="bg-green-100 text-green-800">Disponible</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Historial de Movimientos
              </CardTitle>
              <CardDescription>
                Consulta todos los movimientos de inventario registrados
              </CardDescription>
            </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Producto, SKU, notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filter_branch">Sucursal</Label>
              <Select value={filters.branch_id} onValueChange={(value) => setFilters({...filters, branch_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filter_type">Tipo</Label>
              <Select value={filters.movement_type} onValueChange={(value) => setFilters({...filters, movement_type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="transferencia_entrada">Transferencia In</SelectItem>
                  <SelectItem value="transferencia_salida">Transferencia Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_from">Desde</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({...filters, date_from: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_to">Hasta</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({...filters, date_to: e.target.value})}
              />
            </div>
          </div>

          {/* Indicador de búsqueda activa */}
          {debouncedSearchQuery && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Buscando: "{debouncedSearchQuery}" ({movements.length} resultados)
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-800 px-2 py-1 h-auto"
              >
                Limpiar
              </Button>
            </div>
          )}

          {/* Tabla de movimientos */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Stock Anterior</TableHead>
                  <TableHead className="text-right">Stock Nuevo</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovements ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {debouncedSearchQuery ? 
                        `No se encontraron movimientos que contengan "${debouncedSearchQuery}"` : 
                        'No hay movimientos registrados'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {new Date(movement.movement_date).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <div>
                          {(() => {
                            const product = Array.isArray(movement.product) ? movement.product[0] : movement.product
                            return (
                              <>
                                <div className="font-medium">{product?.name}</div>
                                {product?.sku && (
                                  <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const branch = Array.isArray(movement.branch) ? movement.branch[0] : movement.branch
                          return branch?.name
                        })()}
                      </TableCell>
                      <TableCell>{getMovementTypeBadge(movement.movement_type)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(movement.movement_type, movement.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{movement.previous_quantity}</TableCell>
                      <TableCell className="text-right font-mono">{movement.new_quantity}</TableCell>
                      <TableCell className="text-right">
                        ${movement.cost_price?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        {movement.reference_type && (
                          <Badge variant="outline">
                            {movement.reference_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {movement.notes}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}