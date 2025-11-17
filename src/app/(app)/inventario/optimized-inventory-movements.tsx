'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { LazyLoad, LazyTable } from '@/components/ui/lazy-load'
import { useOptimizedInventory } from '@/hooks/useOptimizedInventory'
import { useOptimizedConfig } from '@/hooks/useOptimizedConfig'
import { 
  Package, 
  Search, 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Building,
  Plus
} from 'lucide-react'

interface OptimizedInventoryMovementsProps {
  // Props if needed
}

export default function OptimizedInventoryMovements(props: OptimizedInventoryMovementsProps) {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const supabase = createClient()

  // Initialize user and organization
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single()

          if (profile?.organization_id) {
            setOrganizationId(profile.organization_id)
            setUserRole(profile.role || '')
          } else {
            setError('No se encontró una organización para este usuario.')
          }
        } else {
          setError('No se pudo obtener la información del usuario.')
        }
      } catch (err) {
        setError('Error al inicializar la aplicación.')
        console.error('Initialization error:', err)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [supabase])

  // Use optimized hooks
  const inventoryHook = useOptimizedInventory({
    organizationId: organizationId || '',
    pageSize: 25
  })

  const configHook = useOptimizedConfig({
    organizationId: organizationId || '',
    includeProducts: true
  })

  const {
    movements,
    loading: movementsLoading,
    error: movementsError,
    pagination,
    paginationActions,
    searchQuery,
    setSearch,
    filters,
    updateFilters,
    clearFilters,
    refresh: refreshMovements
  } = inventoryHook

  const {
    data: configData,
    loading: configLoading
  } = configHook

  // Loading state
  if (loading || !organizationId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getMovementIcon = (type: string) => {
    return type === 'entrada' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  const getMovementBadge = (type: string) => {
    const config = {
      'entrada': { label: 'Entrada', className: 'bg-green-100 text-green-800' },
      'salida': { label: 'Salida', className: 'bg-red-100 text-red-800' },
      'ajuste': { label: 'Ajuste', className: 'bg-blue-100 text-blue-800' },
      'transferencia': { label: 'Transferencia', className: 'bg-purple-100 text-purple-800' }
    }

    const typeConfig = config[type as keyof typeof config] || config.ajuste

    return (
      <Badge className={typeConfig.className}>
        <div className="flex items-center space-x-1">
          {getMovementIcon(type)}
          <span>{typeConfig.label}</span>
        </div>
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Movimientos de Inventario
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Historial completo de entradas, salidas y ajustes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshMovements}
            disabled={movementsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${movementsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={() => {/* TODO: Implement add movement modal */}}
            disabled={configLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por producto o SKU..."
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
            {Object.keys(filters).length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <LazyLoad>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sucursal
                </label>
                <Select
                  value={filters.branchId || ''}
                  onValueChange={(value) => updateFilters({ branchId: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las sucursales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las sucursales</SelectItem>
                    {configData.branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4" />
                          <span>{branch.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Movement Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Movimiento
                </label>
                <Select
                  value={filters.movementType || ''}
                  onValueChange={(value) => updateFilters({ movementType: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los tipos</SelectItem>
                    <SelectItem value="entrada">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span>Entrada</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="salida">
                      <div className="flex items-center space-x-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span>Salida</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={Object.keys(filters).length === 0}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </LazyLoad>
        )}
      </div>

      {/* Movements List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Historial de Movimientos</h2>
        </div>

        {movementsLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Cargando movimientos...</span>
          </div>
        ) : movementsError ? (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-4">Error al cargar los movimientos</div>
            <Button onClick={refreshMovements} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Package className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">
              {searchQuery || Object.keys(filters).length > 0
                ? 'No se encontraron movimientos que coincidan con los criterios'
                : 'No hay movimientos de inventario registrados'
              }
            </p>
          </div>
        ) : (
          <LazyTable>
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sucursal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {movement.product_name}
                            </div>
                            {movement.product_sku && (
                              <div className="text-sm text-gray-500">
                                SKU: {movement.product_sku}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getMovementBadge(movement.movement_type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {movement.movement_type === 'entrada' ? '+' : '-'}
                            {movement.quantity.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {movement.previous_quantity.toLocaleString()} → {movement.new_quantity.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1 text-sm text-gray-900">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span>{movement.branch_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(movement.movement_date)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {movements.map((movement) => (
                  <div key={movement.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {movement.product_name}
                        </div>
                        {movement.product_sku && (
                          <div className="text-sm text-gray-500">
                            SKU: {movement.product_sku}
                          </div>
                        )}
                      </div>
                      {getMovementBadge(movement.movement_type)}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cantidad:</span>
                        <span className="font-medium">
                          {movement.movement_type === 'entrada' ? '+' : '-'}
                          {movement.quantity.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Stock:</span>
                        <span>{movement.previous_quantity.toLocaleString()} → {movement.new_quantity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sucursal:</span>
                        <span>{movement.branch_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fecha:</span>
                        <span>{formatDate(movement.movement_date)}</span>
                      </div>
                    </div>
                    
                    {movement.notes && (
                      <div className="mt-2 text-sm text-gray-600 italic">
                        {movement.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          </LazyTable>
        )}

        {/* Pagination */}
        {movements.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={paginationActions.setPage}
              onPageSizeChange={paginationActions.setPageSize}
              loading={movementsLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}