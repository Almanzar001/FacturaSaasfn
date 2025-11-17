'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Edit, Trash2, FileText, DollarSign, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useOptimizedInvoices } from '@/hooks/useOptimizedInvoices'
import { useOptimizedConfig } from '@/hooks/useOptimizedConfig'

interface OptimizedInvoicesClientProps {
  // Props if needed
}

export default function OptimizedInvoicesClient(props: OptimizedInvoicesClientProps) {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const invoicesHook = useOptimizedInvoices({
    organizationId: organizationId || '',
    pageSize: 25
  })

  const configHook = useOptimizedConfig({
    organizationId: organizationId || '',
    includeClients: true,
    includeProducts: true
  })

  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    pagination,
    paginationActions,
    searchQuery,
    setSearch,
    refresh: refreshInvoices
  } = invoicesHook

  const {
    data: configData,
    loading: configLoading,
    error: configError
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO')
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'paid': { label: 'Pagada', className: 'bg-green-100 text-green-800' },
      'pending': { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
      'overdue': { label: 'Vencida', className: 'bg-red-100 text-red-800' },
      'partially_paid': { label: 'Parcialmente Pagada', className: 'bg-blue-100 text-blue-800' },
      'draft': { label: 'Borrador', className: 'bg-gray-100 text-gray-800' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Facturas</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Gestiona todas tus facturas y pagos
          </p>
        </div>
        <Button
          onClick={() => {/* TODO: Implement create invoice modal */}}
          className="w-full sm:w-auto"
          disabled={configLoading}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por número de factura o cliente..."
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={refreshInvoices}
            disabled={invoicesLoading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Facturas</h2>
        </div>

        {invoicesLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Cargando facturas...</span>
          </div>
        ) : invoicesError ? (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-4">Error al cargar las facturas</div>
            <Button onClick={refreshInvoices} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <FileText className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No se encontraron facturas que coincidan con la búsqueda' : 'No hay facturas registradas'}
            </p>
            {!searchQuery && (
              <Button onClick={() => {/* TODO: Open create modal */}}>
                Crear primera factura
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Número
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.client_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {invoice.client_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>Emitida: {formatDate(invoice.issue_date)}</div>
                          <div>Vence: {formatDate(invoice.due_date)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: Edit invoice */}}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: View PDF */}}
                            title="Ver PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: Manage payments */}}
                            title="Pagos"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: Delete invoice */}}
                            title="Eliminar"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.client_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatCurrency(invoice.total)}
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-3">
                    <div>Emitida: {formatDate(invoice.issue_date)}</div>
                    <div>Vence: {formatDate(invoice.due_date)}</div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* TODO: Edit */}}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* TODO: View PDF */}}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {invoices.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={paginationActions.setPage}
              onPageSizeChange={paginationActions.setPageSize}
              loading={invoicesLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}