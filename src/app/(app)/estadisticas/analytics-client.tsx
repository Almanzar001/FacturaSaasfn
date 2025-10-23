'use client'

import { useState, useEffect } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, TrendingUp, TrendingDown, Users, Receipt, CreditCard, DollarSign } from 'lucide-react'

// Interfaces
interface AnalyticsData {
  invoicesByMonth: Array<{ month: string; count: number; revenue: number; quotes: number }>
  quotesByMonth: Array<{ month: string; count: number; value: number }>
  invoicesByStatus: Array<{ name: string; value: number; color: string }>
  topClients: Array<{ name: string; total: number; invoices: number }>
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  monthlyComparison: {
    currentMonth: { invoices: number; revenue: number; quotes: number }
    previousMonth: { invoices: number; revenue: number; quotes: number }
  }
}

interface DateRange {
  start: Date
  end: Date
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316']

export default function AnalyticsClient() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData>({
    invoicesByMonth: [],
    quotesByMonth: [],
    invoicesByStatus: [],
    topClients: [],
    topProducts: [],
    monthlyComparison: {
      currentMonth: { invoices: 0, revenue: 0, quotes: 0 },
      previousMonth: { invoices: 0, revenue: 0, quotes: 0 }
    }
  })
  const [dateRange, setDateRange] = useState<DateRange>({
    start: subMonths(new Date(), 11), // Últimos 12 meses
    end: new Date()
  })
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (organizationId) {
      fetchAnalyticsData()
    }
  }, [organizationId])

  const initialize = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No se pudo obtener la información del usuario')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id)
      } else {
        setError('No se encontró organización')
      }
    } catch (error) {
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalyticsData = async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      // Generar meses en el rango
      const months = eachMonthOfInterval({
        start: startOfMonth(dateRange.start),
        end: endOfMonth(dateRange.end)
      })

      // Obtener datos de facturas
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id, 
          total, 
          status, 
          issue_date,
          client_id,
          clients (name)
        `)
        .eq('organization_id', organizationId)
        .gte('issue_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('issue_date', format(dateRange.end, 'yyyy-MM-dd'))

      // Obtener datos de cotizaciones
      const { data: quotes } = await supabase
        .from('quotes')
        .select(`
          id,
          total,
          status,
          issue_date,
          client_id,
          clients (name)
        `)
        .eq('organization_id', organizationId)
        .gte('issue_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('issue_date', format(dateRange.end, 'yyyy-MM-dd'))

      // Obtener items de facturas para productos top
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select(`
          quantity,
          unit_price,
          total_price,
          description,
          invoices!inner (
            organization_id,
            issue_date
          )
        `)
        .eq('invoices.organization_id', organizationId)
        .gte('invoices.issue_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('invoices.issue_date', format(dateRange.end, 'yyyy-MM-dd'))

      // Procesar datos para gráficos
      const processedData = processAnalyticsData(
        invoices || [],
        quotes || [],
        invoiceItems || [],
        months
      )

      setData(processedData)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setError('Error al cargar las estadísticas')
    } finally {
      setLoading(false)
    }
  }

  const processAnalyticsData = (
    invoices: any[],
    quotes: any[],
    invoiceItems: any[],
    months: Date[]
  ): AnalyticsData => {
    // Facturas por mes
    const invoicesByMonth = months.map(month => {
      const monthInvoices = invoices.filter(inv => 
        format(new Date(inv.issue_date), 'yyyy-MM') === format(month, 'yyyy-MM')
      )
      const monthQuotes = quotes.filter(quote => 
        format(new Date(quote.issue_date), 'yyyy-MM') === format(month, 'yyyy-MM')
      )
      return {
        month: format(month, 'MMM yyyy', { locale: es }),
        count: monthInvoices.length,
        revenue: monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        quotes: monthQuotes.length
      }
    })

    // Cotizaciones por mes (mantenemos separado para compatibilidad)
    const quotesByMonth = months.map(month => {
      const monthQuotes = quotes.filter(quote => 
        format(new Date(quote.issue_date), 'yyyy-MM') === format(month, 'yyyy-MM')
      )
      return {
        month: format(month, 'MMM yyyy', { locale: es }),
        count: monthQuotes.length,
        value: monthQuotes.reduce((sum, quote) => sum + (quote.total || 0), 0)
      }
    })

    // Facturas por estado
    const statusCounts = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const invoicesByStatus = [
      { name: 'Pagada', value: statusCounts.paid || 0, color: '#10b981' },
      { name: 'Pendiente', value: statusCounts.pending || 0, color: '#f59e0b' },
      { name: 'Vencida', value: statusCounts.overdue || 0, color: '#ef4444' },
      { name: 'Borrador', value: statusCounts.draft || 0, color: '#6b7280' }
    ].filter(item => item.value > 0)

    // Top clientes
    const clientTotals = invoices.reduce((acc, inv) => {
      const clientName = inv.clients?.name || 'Cliente sin nombre'
      if (!acc[clientName]) {
        acc[clientName] = { total: 0, invoices: 0 }
      }
      acc[clientName].total += inv.total || 0
      acc[clientName].invoices += 1
      return acc
    }, {} as Record<string, { total: number; invoices: number }>)

    const topClients = Object.entries(clientTotals)
      .map(([name, data]) => ({ 
        name, 
        total: (data as { total: number; invoices: number }).total, 
        invoices: (data as { total: number; invoices: number }).invoices 
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Top productos
    const productTotals = invoiceItems.reduce((acc, item) => {
      const productName = item.description || 'Producto sin nombre'
      if (!acc[productName]) {
        acc[productName] = { quantity: 0, revenue: 0 }
      }
      acc[productName].quantity += item.quantity || 0
      acc[productName].revenue += item.total_price || 0
      return acc
    }, {} as Record<string, { quantity: number; revenue: number }>)

    const topProducts = Object.entries(productTotals)
      .map(([name, data]) => ({ 
        name, 
        quantity: (data as { quantity: number; revenue: number }).quantity, 
        revenue: (data as { quantity: number; revenue: number }).revenue 
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Comparación del período seleccionado
    const selectedPeriodData = {
      invoices: invoices.length,
      revenue: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      quotes: quotes.length
    }

    // Calcular período anterior del mismo tamaño para comparación
    const periodDurationDays = Math.ceil((months[months.length - 1].getTime() - months[0].getTime()) / (1000 * 60 * 60 * 24))
    const previousPeriodStart = new Date(months[0])
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDurationDays)
    const previousPeriodEnd = new Date(months[0])

    const previousPeriodInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.issue_date)
      return invDate >= previousPeriodStart && invDate < previousPeriodEnd
    })

    const previousPeriodQuotes = quotes.filter(quote => {
      const quoteDate = new Date(quote.issue_date)
      return quoteDate >= previousPeriodStart && quoteDate < previousPeriodEnd
    })

    const previousPeriodData = {
      invoices: previousPeriodInvoices.length,
      revenue: previousPeriodInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      quotes: previousPeriodQuotes.length
    }

    return {
      invoicesByMonth,
      quotesByMonth,
      invoicesByStatus,
      topClients,
      topProducts,
      monthlyComparison: {
        currentMonth: selectedPeriodData,
        previousMonth: previousPeriodData
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount)
  }

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const setDateRangePreset = (preset: string) => {
    const now = new Date()
    let newRange: DateRange
    
    switch (preset) {
      case 'last3months':
        newRange = {
          start: subMonths(now, 2),
          end: now
        }
        break
      case 'last6months':
        newRange = {
          start: subMonths(now, 5),
          end: now
        }
        break
      case 'last12months':
        newRange = {
          start: subMonths(now, 11),
          end: now
        }
        break
      case 'thisYear':
        newRange = {
          start: new Date(now.getFullYear(), 0, 1),
          end: now
        }
        break
      default:
        return
    }
    
    setDateRange(newRange)
    // Auto-fetch data when preset is selected
    if (organizationId) {
      fetchAnalyticsData()
    }
  }

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const newDate = new Date(value)
    const updatedRange = { ...dateRange, [field]: newDate }
    
    // Validation: start date cannot be after end date
    if (field === 'start' && newDate > dateRange.end) {
      alert('La fecha de inicio no puede ser posterior a la fecha de fin')
      return
    }
    
    if (field === 'end' && newDate < dateRange.start) {
      alert('La fecha de fin no puede ser anterior a la fecha de inicio')
      return
    }
    
    // Validation: range cannot be more than 2 years
    const diffInDays = Math.ceil((updatedRange.end.getTime() - updatedRange.start.getTime()) / (1000 * 60 * 60 * 24))
    if (diffInDays > 730) {
      alert('El rango de fechas no puede ser mayor a 2 años')
      return
    }
    
    setDateRange(updatedRange)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando estadísticas...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  const { monthlyComparison } = data

  // Helper function to get period label
  const getPeriodLabel = () => {
    const startDate = format(dateRange.start, 'dd/MM/yyyy')
    const endDate = format(dateRange.end, 'dd/MM/yyyy')
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= 31) {
      return 'este período'
    } else if (daysDiff <= 93) {
      return 'estos meses'
    } else if (daysDiff <= 186) {
      return 'este semestre'
    } else {
      return 'este período'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-gray-600 text-sm sm:text-base">Analiza el rendimiento de tu negocio</p>
        </div>
        
        {/* Date Range Controls */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Custom Date Range */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input
                  type="date"
                  value={format(dateRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  max={format(dateRange.end, 'yyyy-MM-dd')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                <input
                  type="date"
                  value={format(dateRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  min={format(dateRange.start, 'yyyy-MM-dd')}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  if (organizationId) {
                    fetchAnalyticsData()
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors self-end"
              >
                Aplicar
              </button>
            </div>
            
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateRangePreset('last3months')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                3 meses
              </button>
              <button
                onClick={() => setDateRangePreset('last6months')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                6 meses
              </button>
              <button
                onClick={() => setDateRangePreset('last12months')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                12 meses
              </button>
              <button
                onClick={() => setDateRangePreset('thisYear')}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Este año
              </button>
            </div>
          </div>
          
          {/* Selected Range Display */}
          <div className="mt-3 text-sm text-gray-600">
            <span className="font-medium">Período seleccionado:</span> {format(dateRange.start, 'dd/MM/yyyy')} - {format(dateRange.end, 'dd/MM/yyyy')}
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} días
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Facturas del período */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Facturas {getPeriodLabel()}</p>
              <p className="text-2xl font-bold text-gray-900">{monthlyComparison.currentMonth.invoices}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {(() => {
              const growth = calculateGrowth(
                monthlyComparison.currentMonth.invoices,
                monthlyComparison.previousMonth.invoices
              )
              return (
                <>
                  {growth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(growth).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs período anterior</span>
                </>
              )
            })()}
          </div>
        </div>

        {/* Ingresos del período */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos {getPeriodLabel()}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(monthlyComparison.currentMonth.revenue)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {(() => {
              const growth = calculateGrowth(
                monthlyComparison.currentMonth.revenue,
                monthlyComparison.previousMonth.revenue
              )
              return (
                <>
                  {growth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(growth).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs período anterior</span>
                </>
              )
            })()}
          </div>
        </div>

        {/* Cotizaciones del período */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cotizaciones {getPeriodLabel()}</p>
              <p className="text-2xl font-bold text-gray-900">{monthlyComparison.currentMonth.quotes}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {(() => {
              const growth = calculateGrowth(
                monthlyComparison.currentMonth.quotes,
                monthlyComparison.previousMonth.quotes
              )
              return (
                <>
                  {growth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(growth).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs período anterior</span>
                </>
              )
            })()}
          </div>
        </div>

        {/* Total clientes activos */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clientes activos</p>
              <p className="text-2xl font-bold text-gray-900">{data.topClients.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">En el período seleccionado</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facturas por mes */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Facturas por Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.invoicesByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ingresos por mes */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Ingresos por Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.invoicesByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3}
                name="Ingresos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de facturas */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Estado de Facturas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.invoicesByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.invoicesByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cotizaciones vs Facturas */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Cotizaciones vs Facturas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.invoicesByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                name="Facturas"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="quotes" 
                stroke="#8b5cf6" 
                name="Cotizaciones"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Top Clientes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facturas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.topClients.map((client, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.invoices}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(client.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Productos */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Top Productos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.topProducts.map((product, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}