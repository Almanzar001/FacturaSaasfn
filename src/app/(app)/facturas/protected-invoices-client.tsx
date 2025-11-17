'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { InvoiceAccess } from '@/components/auth/PermissionGuard'
import { BranchSelector, useSelectedBranch } from '@/components/ui/branch-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { 
  Plus, 
  Search, 
  FileText, 
  DollarSign, 
  Edit, 
  Trash2,
  Building,
  AlertCircle,
  Filter
} from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_email: string
  branch_id: string
  branch_name?: string
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partially_paid'
  issue_date: string
  due_date: string
  created_at: string
  created_by?: string
}

interface ProtectedInvoicesClientProps {
  organizationId: string
}

export default function ProtectedInvoicesClient({ organizationId }: ProtectedInvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { toast } = useToast()
  const { 
    userRole, 
    canAccessBranch, 
    assignedBranches, 
    hasPermission 
  } = usePermissions()
  
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    availableBranches
  } = useSelectedBranch()

  const supabase = createClient()

  useEffect(() => {
    if (organizationId) {
      fetchInvoices()
    }
  }, [organizationId, selectedBranchId])

  useEffect(() => {
    filterInvoices()
  }, [invoices, searchQuery, statusFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          client_id,
          branch_id,
          total,
          status,
          issue_date,
          due_date,
          created_at,
          created_by,
          clients!inner(name, email),
          branches!inner(name, organization_id)
        `)
        .eq('branches.organization_id', organizationId)
        .order('created_at', { ascending: false })

      // Si no es propietario ni administrador, filtrar por sucursales asignadas
      if (userRole !== 'propietario' && userRole !== 'administrador') {
        if (selectedBranchId) {
          // Si hay una sucursal específica seleccionada, filtrar por ella
          query = query.eq('branch_id', selectedBranchId)
        } else if (assignedBranches.length > 0) {
          // Si no hay sucursal seleccionada, usar todas las asignadas
          const branchIds = assignedBranches.map(b => b.branch_id)
          query = query.in('branch_id', branchIds)
        } else {
          // Si no tiene sucursales asignadas, no mostrar facturas
          setInvoices([])
          setLoading(false)
          return
        }
      } else if (selectedBranchId && selectedBranchId !== 'all') {
        // Para propietarios/administradores con sucursal específica seleccionada
        query = query.eq('branch_id', selectedBranchId)
      }

      const { data, error } = await query.limit(500)

      if (error) throw error

      const formattedInvoices = (data || []).map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: Array.isArray(invoice.clients) ? invoice.clients[0]?.name : invoice.clients?.name,
        client_email: Array.isArray(invoice.clients) ? invoice.clients[0]?.email : invoice.clients?.email,
        branch_id: invoice.branch_id,
        branch_name: Array.isArray(invoice.branches) ? invoice.branches[0]?.name : invoice.branches?.name,
        total: invoice.total,
        status: invoice.status,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        created_at: invoice.created_at,
        created_by: invoice.created_by
      }))

      setInvoices(formattedInvoices)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las facturas",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const filterInvoices = () => {
    let filtered = invoices

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(query) ||
        invoice.client_name.toLowerCase().includes(query) ||
        invoice.client_email.toLowerCase().includes(query)
      )
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter)
    }

    setFilteredInvoices(filtered)
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
      <Badge className={config.className}>
        {config.label}
      </Badge>
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

  const canCreateInvoices = hasPermission('create_invoices')
  const canEditInvoices = hasPermission('edit_invoices')
  const canDeleteInvoices = hasPermission('delete_invoices')

  return (
    <InvoiceAccess>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center space-x-2">
              <FileText className="h-6 w-6" />
              <span>Facturas</span>
            </h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">
              {userRole === 'propietario' || userRole === 'administrador' 
                ? 'Gestiona todas las facturas de la organización'
                : 'Gestiona las facturas de tus sucursales asignadas'
              }
            </p>
          </div>
          
          {canCreateInvoices && selectedBranchId && (
            <Button
              onClick={() => {/* TODO: Implementar crear factura */}}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Factura
            </Button>
          )}
        </div>

        {/* Selector de sucursal y filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Selector de sucursal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sucursal
                </label>
                <BranchSelector
                  value={selectedBranchId}
                  onValueChange={setSelectedBranchId}
                  showAllOption={userRole === 'propietario' || userRole === 'administrador'}
                  allOptionLabel="Todas las sucursales"
                  placeholder="Seleccionar sucursal"
                />
              </div>

              {/* Búsqueda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Número de factura o cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtro de estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="draft">Borrador</option>
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagada</option>
                  <option value="partially_paid">Parcialmente Pagada</option>
                  <option value="overdue">Vencida</option>
                </select>
              </div>

              {/* Botón de actualizar */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={fetchInvoices}
                  disabled={loading}
                  className="w-full"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información de la sucursal seleccionada */}
        {selectedBranch && selectedBranchId !== 'all' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Mostrando facturas de: <strong>{selectedBranch.branch_name}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Advertencia si no tiene sucursales asignadas */}
        {assignedBranches.length === 0 && userRole !== 'propietario' && userRole !== 'administrador' && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Sin sucursales asignadas</p>
                  <p className="text-sm">
                    Contacta al administrador para que te asigne a una o más sucursales.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de facturas */}
        <Card>
          <CardHeader>
            <CardTitle>
              Facturas ({filteredInvoices.length})
            </CardTitle>
            <CardDescription>
              {searchQuery || statusFilter !== 'all' 
                ? `Resultados filtrados de ${invoices.length} facturas`
                : `Total de facturas disponibles`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2">Cargando facturas...</span>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center p-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No se encontraron facturas que coincidan con los filtros'
                    : 'No hay facturas registradas'
                  }
                </p>
                {canCreateInvoices && selectedBranchId && !searchQuery && statusFilter === 'all' && (
                  <Button onClick={() => {/* TODO: Crear factura */}}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primera factura
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    {(userRole === 'propietario' || userRole === 'administrador') && (
                      <TableHead>Sucursal</TableHead>
                    )}
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.client_name}</div>
                          <div className="text-sm text-gray-500">{invoice.client_email}</div>
                        </div>
                      </TableCell>
                      {(userRole === 'propietario' || userRole === 'administrador') && (
                        <TableCell>
                          <div className="flex items-center space-x-1 text-sm">
                            <Building className="h-3 w-3 text-gray-400" />
                            <span>{invoice.branch_name}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Emitida: {formatDate(invoice.issue_date)}</div>
                          <div className="text-gray-500">Vence: {formatDate(invoice.due_date)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: Ver PDF */}}
                            title="Ver PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          
                          {canEditInvoices && canAccessBranch(invoice.branch_id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {/* TODO: Editar */}}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* TODO: Gestionar pagos */}}
                            title="Gestionar pagos"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          
                          {canDeleteInvoices && canAccessBranch(invoice.branch_id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {/* TODO: Eliminar */}}
                              title="Eliminar"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </InvoiceAccess>
  )
}