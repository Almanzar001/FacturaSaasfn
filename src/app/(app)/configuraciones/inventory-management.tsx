'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Settings, AlertTriangle, TrendingUp, BarChart3, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface InventorySettings {
  id: string
  organization_id: string
  inventory_enabled: boolean
  low_stock_threshold: number
  auto_deduct_on_invoice: boolean
  require_stock_validation: boolean
}

interface InventoryStats {
  total_products: number
  tracked_products: number
  low_stock_items: number
  total_branches: number
  inventory_enabled: boolean
}

interface LowStockProduct {
  product_id: string
  product_name: string
  branch_id: string
  branch_name: string
  current_stock: number
  min_stock: number
  sku: string | null
}

interface Branch {
  id: string
  name: string
  code: string
  is_active: boolean
}

interface Product {
  id: string
  name: string
  sku: string | null
  is_inventory_tracked: boolean
  unit_of_measure: string
}

interface StockData {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_stock: number
  max_stock: number | null
  cost_price: number | null
  product?: Product
  branch?: Branch
}

interface InventoryManagementProps {
  organizationId: string
  userRole: string
}

export default function InventoryManagement({ organizationId, userRole }: InventoryManagementProps) {
  const [settings, setSettings] = useState<InventorySettings | null>(null)
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockData, setStockData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState<string>('')

  const supabase = createClient()
  const canManage = userRole === 'propietario' || userRole === 'administrador'

  useEffect(() => {
    if (organizationId) {
      fetchData()
    }
  }, [organizationId])

  const fetchData = async () => {
    if (!organizationId) {
      console.error('No organizationId provided')
      return
    }
    
    setLoading(true)
    try {
      // Cargar datos de forma individual para mejor manejo de errores
      await fetchInventorySettings().catch(e => console.error('Error loading settings:', e))
      await fetchInventoryStats().catch(e => console.error('Error loading stats:', e))
      await fetchLowStockProducts().catch(e => console.error('Error loading low stock:', e))
      await fetchBranches().catch(e => console.error('Error loading branches:', e))
      await fetchProducts().catch(e => console.error('Error loading products:', e))
      
      if (branches.length > 0) {
        setSelectedBranch(branches[0].id)
        await fetchStockData(branches[0].id).catch(e => console.error('Error loading stock data:', e))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      // Removed alert to avoid annoying the user
    } finally {
      setLoading(false)
    }
  }

  const fetchInventorySettings = async () => {
    const { data, error } = await supabase
      .from('inventory_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    setSettings(data)
  }

  const fetchInventoryStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_inventory_stats', { org_id: organizationId })

      if (error) {
        console.warn('RPC get_inventory_stats failed, using fallback:', error.message)
        await createBasicStats()
        return
      }
      
      if (data && data.length > 0) {
        setStats(data[0])
      } else {
        await createBasicStats()
      }
    } catch (error) {
      console.warn('fetchInventoryStats failed, using fallback')
      await createBasicStats()
    }
  }

  const createBasicStats = async () => {
    try {
      // Crear stats básicas manualmente
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

      const { count: trackedProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_inventory_tracked', true)

      const { count: branchesCount } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      setStats({
        total_products: productsCount || 0,
        tracked_products: trackedProducts || 0,
        low_stock_items: 0,
        total_branches: branchesCount || 0,
        inventory_enabled: true
      })
    } catch (error) {
      console.error('Error creating basic stats:', error)
      setStats({
        total_products: 0,
        tracked_products: 0,
        low_stock_items: 0,
        total_branches: 0,
        inventory_enabled: true
      })
    }
  }

  const fetchLowStockProducts = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_low_stock_products', { org_id: organizationId })

      if (error) {
        console.warn('RPC get_low_stock_products failed, using fallback:', error.message)
        await fetchLowStockManually()
        return
      }
      
      setLowStockProducts(data || [])
    } catch (error) {
      console.warn('fetchLowStockProducts failed, using fallback')
      await fetchLowStockManually()
    }
  }

  const fetchLowStockManually = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          quantity,
          min_stock,
          product:products!inner(id, name, sku, organization_id),
          branch:branches!inner(id, name, organization_id)
        `)
        .eq('product.organization_id', organizationId)
        .eq('branch.organization_id', organizationId)
        .lt('quantity', 5) // Productos con menos de 5 en stock

      if (error) throw error

      const lowStock = (data || []).map((item: any) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        branch_id: item.branch.id,
        branch_name: item.branch.name,
        current_stock: item.quantity,
        min_stock: item.min_stock || 5,
        sku: item.product.sku
      }))

      setLowStockProducts(lowStock)
    } catch (error) {
      console.error('Error fetching low stock manually:', error)
      setLowStockProducts([])
    }
  }

  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    setBranches(data || [])
  }

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, is_inventory_tracked, unit_of_measure')
      .eq('organization_id', organizationId)
      .eq('is_inventory_tracked', true)
      .order('name')

    if (error) throw error
    setProducts(data || [])
  }

  const fetchStockData = async (branchId: string) => {
    const { data, error } = await supabase
      .from('inventory_stock')
      .select(`
        *,
        products!inner(id, name, sku, is_inventory_tracked, unit_of_measure),
        branches!inner(id, name, code, is_active)
      `)
      .eq('branch_id', branchId)
      .order('quantity', { ascending: true })

    if (error) throw error
    setStockData(data || [])
  }

  const updateSettings = async (newSettings: Partial<InventorySettings>) => {
    if (!canManage) {
      alert('No tienes permisos para modificar estas configuraciones')
      return
    }

    try {
      const { data, error } = await supabase
        .rpc('upsert_inventory_settings', {
          p_organization_id: organizationId,
          p_inventory_enabled: newSettings.inventory_enabled,
          p_low_stock_threshold: newSettings.low_stock_threshold,
          p_auto_deduct_on_invoice: newSettings.auto_deduct_on_invoice,
          p_require_stock_validation: newSettings.require_stock_validation
        })

      if (error) throw error

      await fetchInventorySettings()
      await fetchInventoryStats()
      alert('Configuración actualizada exitosamente')
    } catch (error: any) {
      alert('Error al actualizar la configuración: ' + (error.message || 'Error desconocido'))
    }
  }

  const enableInventoryForProduct = async (productId: string) => {
    if (!canManage) return

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_inventory_tracked: true })
        .eq('id', productId)

      if (error) throw error
      await fetchProducts()
      alert('Inventario habilitado para el producto')
    } catch (error: any) {
      alert('Error al habilitar inventario: ' + (error.message || 'Error desconocido'))
    }
  }

  const updateStockLevel = async (stockId: string, field: string, value: number) => {
    if (!canManage) return

    try {
      const { error } = await supabase
        .rpc('upsert_inventory_stock_level', {
          p_stock_id: stockId,
          p_field_name: field,
          p_value: value
        })

      if (error) throw error
      await fetchStockData(selectedBranch)
    } catch (error: any) {
      alert('Error al actualizar: ' + (error.message || 'Error desconocido'))
    }
  }

  const registerInventoryMovement = async (productId: string, quantity: number, notes: string) => {
    if (!canManage) return

    try {
      const { error } = await supabase
        .rpc('register_inventory_movement', {
          p_product_id: productId,
          p_branch_id: selectedBranch,
          p_movement_type: quantity > 0 ? 'entrada' : 'salida',
          p_quantity: quantity,
          p_reference_type: 'ajuste',
          p_notes: notes
        })

      if (error) throw error
      await fetchStockData(selectedBranch)
      await fetchLowStockProducts()
      await fetchInventoryStats()
      alert('Movimiento registrado exitosamente')
    } catch (error: any) {
      alert('Error al registrar movimiento: ' + (error.message || 'Error desconocido'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats?.tracked_products || 0}</p>
                <p className="text-xs text-muted-foreground">Productos con Inventario</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats?.low_stock_items || 0}</p>
                <p className="text-xs text-muted-foreground">Stock Bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats?.total_branches || 0}</p>
                <p className="text-xs text-muted-foreground">Sucursales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats?.total_products || 0}</p>
                <p className="text-xs text-muted-foreground">Total Productos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Configuración</TabsTrigger>
          <TabsTrigger value="stock">Stock por Sucursal</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración de Inventario
              </CardTitle>
              <CardDescription>
                Configura cómo funciona el sistema de inventario en tu organización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-medium">Habilitar Inventario</h4>
                  <p className="text-sm text-muted-foreground">
                    Activa el sistema de control de inventario para la organización
                  </p>
                </div>
                <Switch
                  checked={settings?.inventory_enabled || false}
                  onCheckedChange={(checked) => updateSettings({ inventory_enabled: checked })}
                  disabled={!canManage}
                />
              </div>

              {settings?.inventory_enabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Umbral de Stock Bajo
                      </label>
                      <Input
                        type="number"
                        value={settings.low_stock_threshold}
                        onChange={(e) => updateSettings({ low_stock_threshold: parseInt(e.target.value) || 10 })}
                        disabled={!canManage}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Cantidad mínima antes de considerar stock bajo
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Deducir Automáticamente en Facturas</h4>
                        <p className="text-xs text-muted-foreground">
                          Reduce el stock automáticamente al crear facturas
                        </p>
                      </div>
                      <Switch
                        checked={settings.auto_deduct_on_invoice}
                        onCheckedChange={(checked) => updateSettings({ auto_deduct_on_invoice: checked })}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Validar Stock Disponible</h4>
                        <p className="text-xs text-muted-foreground">
                          Prevenir ventas si no hay stock suficiente
                        </p>
                      </div>
                      <Switch
                        checked={settings.require_stock_validation}
                        onCheckedChange={(checked) => updateSettings({ require_stock_validation: checked })}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          {settings?.inventory_enabled ? (
            <>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Sucursal:</label>
                <select
                  className="border rounded px-3 py-1"
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value)
                    fetchStockData(e.target.value)
                  }}
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Stock de Productos</CardTitle>
                  <CardDescription>
                    Gestiona el inventario de productos por sucursal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stockData.map((stock) => (
                      <div key={stock.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{stock.product?.name}</h4>
                            {stock.product?.sku && (
                              <p className="text-sm text-muted-foreground">SKU: {stock.product.sku}</p>
                            )}
                          </div>
                          <Badge 
                            variant={stock.quantity <= (stock.min_stock || 0) ? "destructive" : "secondary"}
                          >
                            {stock.quantity} {stock.product?.unit_of_measure || 'unidades'}
                          </Badge>
                        </div>
                        
                        {canManage && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                            <div>
                              <label className="text-xs">Stock Mínimo</label>
                              <Input
                                type="number"
                                value={stock.min_stock || 0}
                                onChange={(e) => updateStockLevel(stock.id, 'min_stock', parseInt(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs">Stock Máximo</label>
                              <Input
                                type="number"
                                value={stock.max_stock || ''}
                                onChange={(e) => updateStockLevel(stock.id, 'max_stock', e.target.value ? parseInt(e.target.value) : 0)}
                                className="h-8"
                                placeholder="Sin límite"
                              />
                            </div>
                            <div>
                              <label className="text-xs">Costo</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={stock.cost_price || ''}
                                onChange={(e) => updateStockLevel(stock.id, 'cost_price', e.target.value ? parseFloat(e.target.value) : 0)}
                                className="h-8"
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex items-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const quantity = prompt('Cantidad a agregar (usar negativo para quitar):')
                                  if (quantity) {
                                    const notes = prompt('Notas del movimiento:') || 'Ajuste manual'
                                    registerInventoryMovement(stock.product_id, parseInt(quantity), notes)
                                  }
                                }}
                                className="h-8"
                              >
                                Ajustar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {stockData.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No hay productos con inventario en esta sucursal</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Inventario Deshabilitado</h3>
                <p className="text-muted-foreground mb-4">
                  Habilita el inventario en la pestaña de configuración para gestionar el stock de productos.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Productos con Stock Bajo
              </CardTitle>
              <CardDescription>
                Productos que han alcanzado el umbral mínimo de stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length > 0 ? (
                <div className="space-y-3">
                  {lowStockProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50">
                      <div>
                        <h4 className="font-medium">{product.product_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {product.branch_name} • {product.sku && `SKU: ${product.sku}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-red-600 font-medium">{product.current_stock}</span>
                          <span className="text-muted-foreground"> / {product.min_stock} mín</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay productos con stock bajo</p>
                  <p className="text-sm">¡Excelente gestión de inventario!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}