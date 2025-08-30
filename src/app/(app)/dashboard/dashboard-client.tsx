'use client'

import { useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Users, DollarSign, TrendingUp, TrendingDown, FileText, Receipt, ArrowUpRight, ArrowDownRight, Package, CreditCard, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTodayDateString } from '@/lib/utils'


interface DashboardStats {
  totalRevenue: number
  totalPaymentsRevenue?: number
  totalGeneralIncome?: number
  totalExpenses: number
  totalProfit: number
  totalClients: number
  totalInvoices: number
  totalQuotes: number
  totalProducts: number
  totalExpensesCount: number
  totalIncomeCount?: number
  totalPaymentsCount?: number
  revenueTrend?: number
  paymentsTrend?: number
  incomeTrend?: number
  expensesTrend?: number
  profitTrend?: number
  clientsTrend?: number
  invoicesTrend?: number
  quotesTrend?: number
}

interface Activity {
  id: string
  type: 'invoice' | 'quote' | 'client' | 'expense'
  title: string
  description: string
  amount?: number
  timestamp: string
  status: 'success' | 'pending' | 'warning'
}

type TimeFilter = 'thismonth' | '3months' | '6months';

export default function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalPaymentsRevenue: 0,
    totalGeneralIncome: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalClients: 0,
    totalInvoices: 0,
    totalQuotes: 0,
    totalProducts: 0,
    totalExpensesCount: 0,
    totalIncomeCount: 0,
    totalPaymentsCount: 0,
    revenueTrend: 0,
    paymentsTrend: 0,
    incomeTrend: 0,
    expensesTrend: 0,
    profitTrend: 0,
    clientsTrend: 0,
    invoicesTrend: 0,
    quotesTrend: 0,
  })

  const [activities, setActivities] = useState<Activity[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('thismonth')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (user) {
        setUser(user);
        fetchDashboardData(user);
      }
    };
    initialize();
  }, [])

  useEffect(() => {
    if (user) {
      fetchDashboardData(user);
    }
  }, [timeFilter])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchDashboardData(user, true); // Silent refresh
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, timeFilter])

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchDashboardData(user);
    setRefreshing(false);
    setLastRefresh(new Date());
  }, [user, timeFilter])

  // Export refresh function for external use
  useEffect(() => {
    (window as any).refreshDashboard = handleRefresh;
    return () => {
      delete (window as any).refreshDashboard;
    };
  }, [handleRefresh])

  const getDateRange = (filter: TimeFilter) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (filter) {
      case 'thismonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  const fetchDashboardData = async (user: User, silent: boolean = false) => {
    const supabase = createClient();
    if (!silent) {
      setLoading(true);
    }
    
    try {
      const { startDate, endDate } = getDateRange(timeFilter);
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, onboarding_completed')
        .eq('id', user.id)
        .single();


      if (profile?.organization_id) {
        // Definir fecha actual para limitar fechas futuras
        const today = getTodayDateString();
        const endDateString = endDate.split('T')[0];
        const effectiveEndDate = endDateString > today ? today : endDateString;
        
        let data = null;
        let error = null;
        
        try {
          // Ejecutar todas las consultas en paralelo para máximo rendimiento
          const [
            clientsResult,
            invoicesResult,
            quotesResult,
            paymentsResult,
            productsResult,
            generalIncomeResult,
            expensesResult
          ] = await Promise.all([
            // Consultar clientes
            supabase
              .from('clients')
              .select('id')
              .eq('organization_id', profile.organization_id),
            
            // Consultar facturas según el filtro de tiempo usando issue_date
            supabase
              .from('invoices')
              .select('id, total, issue_date')
              .eq('organization_id', profile.organization_id)
              .gte('issue_date', startDate.split('T')[0])
              .lte('issue_date', effectiveEndDate)
              .order('issue_date', { ascending: false }),
            
            // Consultar cotizaciones según el filtro de tiempo
            supabase
              .from('quotes')
              .select('id, total, created_at')
              .eq('organization_id', profile.organization_id)
              .gte('created_at', startDate)
              .lte('created_at', endDate)
              .order('created_at', { ascending: false }),
            
            // Consultar pagos según el filtro de tiempo
            supabase
              .from('payments')
              .select('amount, payment_date, id')
              .eq('organization_id', profile.organization_id)
              .gte('payment_date', startDate.split('T')[0])
              .lte('payment_date', effectiveEndDate)
              .order('payment_date', { ascending: false }),
            
            // Consultar productos
            supabase
              .from('products')
              .select('id')
              .eq('organization_id', profile.organization_id),
            
            // Consultar ingresos generales según el filtro de tiempo
            supabase
              .from('general_income')
              .select('amount, income_date, id, description, category')
              .eq('organization_id', profile.organization_id)
              .gte('income_date', startDate.split('T')[0])
              .lte('income_date', effectiveEndDate)
              .order('income_date', { ascending: false }),
            
            // Consultar gastos según el filtro de tiempo usando expense_date
            supabase
              .from('expenses')
              .select('*')
              .eq('organization_id', profile.organization_id)
              .gte('expense_date', startDate.split('T')[0])
              .lte('expense_date', effectiveEndDate)
              .order('expense_date', { ascending: false })
          ]);
          
          // Verificar errores críticos
          if (paymentsResult.error) {
            throw paymentsResult.error;
          }

          // Los gastos - manejar caso donde la consulta falla
          const filteredExpenses = expensesResult.data || [];
          
          // Calcular totales
          const totalPayments = paymentsResult.data?.reduce((sum, p) => {
            const amount = parseFloat(p.amount) || 0;
            return sum + amount;
          }, 0) || 0;

          const totalGeneralIncome = generalIncomeResult.data?.reduce((sum, i) => {
            const amount = parseFloat(i.amount) || 0;
            return sum + amount;
          }, 0) || 0;
          
          const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => {
            const amount = parseFloat(e.amount) || 0;
            return sum + amount;
          }, 0);
          
          // Contar facturas, cotizaciones, productos y gastos
          const totalInvoices = invoicesResult.data?.length || 0;
          const totalQuotes = quotesResult.data?.length || 0;
          const totalProducts = productsResult.data?.length || 0;
          const totalExpensesCount = expensesResult.data?.length || 0;
          const totalGeneralIncomeCount = generalIncomeResult.data?.length || 0;

          // Calcular ingresos totales (pagos + ingresos generales)
          const totalRevenue = totalPayments + totalGeneralIncome;
          


          // Construir actividades recientes
          const activities = [];
          
          // Agregar facturas recientes
          if (invoicesResult.data && invoicesResult.data.length > 0) {
            const recentInvoices = invoicesResult.data
              .slice(0, 3)
              .map((invoice: any, index: number) => ({
                id: `invoice-${invoice.id}`,
                type: 'invoice' as const,
                title: `Nueva factura creada`,
                description: `Factura por $${invoice.total}`,
                amount: parseFloat(invoice.total),
                timestamp: invoice.issue_date || new Date().toISOString(),
                status: 'success' as const
              }));
            activities.push(...recentInvoices);
          }

          // Agregar pagos recientes
          if (paymentsResult.data && paymentsResult.data.length > 0) {
            const recentPayments = paymentsResult.data
              .slice(0, 2)
              .map((payment: any) => ({
                id: `payment-${payment.id}`,
                type: 'invoice' as const,
                title: `Pago recibido`,
                description: `Pago de $${payment.amount}`,
                amount: parseFloat(payment.amount),
                timestamp: payment.payment_date,
                status: 'success' as const
              }));
            activities.push(...recentPayments);
          }

          // Agregar ingresos generales recientes
          if (generalIncomeResult.data && generalIncomeResult.data.length > 0) {
            const recentGeneralIncome = generalIncomeResult.data
              .slice(0, 2)
              .map((income: any) => ({
                id: `income-${income.id}`,
                type: 'invoice' as const,
                title: `Ingreso general`,
                description: `Ingreso de $${income.amount}`,
                amount: parseFloat(income.amount),
                timestamp: income.income_date,
                status: 'success' as const
              }));
            activities.push(...recentGeneralIncome);
          }

          // Agregar gastos recientes
          if (filteredExpenses && filteredExpenses.length > 0) {
            const recentExpenses = filteredExpenses
              .slice(0, 2)
              .map((expense: any) => ({
                id: `expense-${expense.id}`,
                type: 'expense' as const,
                title: `Nuevo gasto`,
                description: `${expense.description || expense.category}`,
                amount: parseFloat(expense.amount),
                timestamp: expense.expense_date,
                status: 'warning' as const
              }));
            activities.push(...recentExpenses);
          }

          // Ordenar por fecha más reciente y limitar a 5
          const sortedActivities = activities
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);
          
          data = {
            totalRevenue: totalRevenue,
            totalPaymentsRevenue: totalPayments,
            totalGeneralIncome: totalGeneralIncome,
            totalExpenses: totalExpenses,
            totalProfit: totalRevenue - totalExpenses,
            totalClients: clientsResult.data?.length || 0,
            totalInvoices: totalInvoices,
            totalQuotes: totalQuotes,
            totalProducts: totalProducts,
            totalExpensesCount: totalExpensesCount,
            totalPaymentsCount: paymentsResult.data?.length || 0,
            totalIncomeCount: totalGeneralIncomeCount,
            revenueTrend: 0,
            paymentsTrend: 0,
            incomeTrend: 0,
            expensesTrend: 0,
            profitTrend: 0,
            clientsTrend: 0,
            invoicesTrend: 0,
            quotesTrend: 0,
            activities: sortedActivities
          };
          
          error = null;
          
        } catch (directError) {
          error = directError;
          data = null;
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }

        if (error) {
          // Set default values for new organizations
          setStats({
            totalRevenue: 0,
            totalPaymentsRevenue: 0,
            totalGeneralIncome: 0,
            totalExpenses: 0,
            totalProfit: 0,
            totalClients: 0,
            totalInvoices: 0,
            totalQuotes: 0,
            totalProducts: 0,
            totalExpensesCount: 0,
            totalIncomeCount: 0,
            totalPaymentsCount: 0,
            revenueTrend: 0,
            paymentsTrend: 0,
            incomeTrend: 0,
            expensesTrend: 0,
            profitTrend: 0,
            clientsTrend: 0,
            invoicesTrend: 0,
            quotesTrend: 0,
          });
          
          // Set welcome activities for new organizations
          setActivities([
            {
              id: '1',
              type: 'client',
              title: 'Bienvenido a FacturaSaaS',
              description: 'Comienza agregando tu primer cliente',
              timestamp: new Date().toLocaleDateString('es-DO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              status: 'pending'
            },
            {
              id: '2',
              type: 'invoice',
              title: 'Configura tu organización',
              description: 'Completa la información de tu empresa en configuraciones',
              timestamp: new Date().toLocaleDateString('es-DO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              status: 'pending'
            }
          ]);
          return;
        }

        setStats({
          totalRevenue: data?.totalRevenue || 0,
          totalPaymentsRevenue: data?.totalPaymentsRevenue || 0,
          totalGeneralIncome: data?.totalGeneralIncome || 0,
          totalExpenses: data?.totalExpenses || 0,
          totalProfit: data?.totalProfit || 0,
          totalClients: data?.totalClients || 0,
          totalInvoices: data?.totalInvoices || 0,
          totalQuotes: data?.totalQuotes || 0,
          totalProducts: data?.totalProducts || 0,
          totalExpensesCount: data?.totalExpensesCount || 0,
          totalIncomeCount: data?.totalIncomeCount || 0,
          totalPaymentsCount: data?.totalPaymentsCount || 0,
          revenueTrend: data?.revenueTrend || 0,
          paymentsTrend: data?.paymentsTrend || 0,
          incomeTrend: data?.incomeTrend || 0,
          expensesTrend: data?.expensesTrend || 0,
          profitTrend: data?.profitTrend || 0,
          clientsTrend: data?.clientsTrend || 0,
          invoicesTrend: data?.invoicesTrend || 0,
          quotesTrend: data?.quotesTrend || 0,
        });
        
        // Formatear actividades con fechas localizadas
        if (data?.activities && Array.isArray(data.activities)) {
          const formattedActivities = data.activities.map((activity: any) => ({
            ...activity,
            timestamp: new Date(activity.timestamp).toLocaleDateString('es-DO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          }));
          setActivities(formattedActivities);
        } else {
          setActivities([]);
        }
      } else {
        // Handle case where user has no organization (shouldn't happen with new trigger)
        setActivities([
          {
            id: '1',
            type: 'client',
            title: 'Configuración pendiente',
            description: 'Tu organización se está configurando...',
            timestamp: new Date().toLocaleDateString('es-DO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            status: 'warning'
          }
        ]);
      }
    } catch (error) {
      // Handle error silently
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(amount)
  }

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case 'thismonth': return 'este mes'
      case '3months': return 'últimos 3 meses'
      case '6months': return 'últimos 6 meses'
      default: return 'período actual'
    }
  }

  const getTimeFilterLabelWithPreposition = () => {
    switch (timeFilter) {
      case 'thismonth': return 'de este mes'
      case '3months': return 'de los últimos 3 meses'
      case '6months': return 'de los últimos 6 meses'
      default: return 'del período actual'
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, trend, description }: {
    title: string
    value: string | number
    icon: any
    color: string
    trend?: number
    description?: string
  }) => (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-medium h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center items-center">
        <div className="text-center w-full">
          <div className="text-2xl font-bold mb-2">{value}</div>
          {trend !== undefined && trend !== 0 && (
            <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
              {trend > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-success-600" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-error-600" />
              )}
              <span className={trend > 0 ? 'text-success-600' : 'text-error-600'}>
                {Math.abs(trend)}% desde el mes pasado
              </span>
            </div>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Bienvenido de vuelta, {user?.user_metadata.full_name || user?.email}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Última actualización: {lastRefresh.toLocaleTimeString('es-DO', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Período:</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeFilter('thismonth')}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                timeFilter === 'thismonth'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setTimeFilter('3months')}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                timeFilter === '3months'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            >
              3 Meses
            </button>
            <button
              onClick={() => setTimeFilter('6months')}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                timeFilter === '6months'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            >
              6 Meses
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          <StatCard
            title="Ingresos Totales"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            color="text-success-600"
            trend={stats.revenueTrend}
            description={`Ingresos ${getTimeFilterLabelWithPreposition()}`}
          />
          <StatCard
            title="Egresos"
            value={formatCurrency(stats.totalExpenses)}
            icon={TrendingDown}
            color="text-error-600"
            trend={stats.expensesTrend}
            description={`Gastos ${getTimeFilterLabelWithPreposition()}`}
          />
          <StatCard
            title="Ganancia Neta"
            value={formatCurrency(stats.totalProfit)}
            icon={BarChart3}
            color="text-primary-600"
            trend={stats.profitTrend}
            description={`Beneficio ${getTimeFilterLabelWithPreposition()}`}
          />
          <StatCard
            title="Clientes Nuevos"
            value={stats.totalClients}
            icon={Users}
            color="text-purple-600"
            trend={stats.clientsTrend}
            description="Nuevos clientes este mes"
          />
        </div>
        )}

        {/* Additional Stats */}
        {!loading && (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          <Card className="h-full flex flex-col justify-center items-center text-center p-4">
            <FileText className="h-8 w-8 text-primary-600 mb-2" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Facturas</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">{`Facturas ${getTimeFilterLabelWithPreposition()}`}</p>
            <div className="text-xl sm:text-2xl font-bold mb-2">{stats.totalInvoices}</div>
            {stats.invoicesTrend !== undefined && stats.invoicesTrend !== 0 && (
              <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
                {stats.invoicesTrend > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-success-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-error-600" />
                )}
                <span className={stats.invoicesTrend > 0 ? 'text-success-600' : 'text-error-600'}>
                  {Math.abs(stats.invoicesTrend)}% desde el mes pasado
                </span>
              </div>
            )}
          </Card>

          <Card className="h-full flex flex-col justify-center items-center text-center p-4">
            <Receipt className="h-8 w-8 text-warning-600 mb-2" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Cotizaciones</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">{`Cotizaciones ${getTimeFilterLabelWithPreposition()}`}</p>
            <div className="text-xl sm:text-2xl font-bold mb-2">{stats.totalQuotes}</div>
            {stats.quotesTrend !== undefined && stats.quotesTrend !== 0 && (
              <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
                {stats.quotesTrend > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-success-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-error-600" />
                )}
                <span className={stats.quotesTrend > 0 ? 'text-success-600' : 'text-error-600'}>
                  {Math.abs(stats.quotesTrend)}% desde el mes pasado
                </span>
              </div>
            )}
          </Card>

          <Card className="h-full flex flex-col justify-center items-center text-center p-4">
            <Package className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Productos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">Total de productos registrados</p>
            <div className="text-xl sm:text-2xl font-bold">{stats.totalProducts}</div>
          </Card>

          <Card className="h-full flex flex-col justify-center items-center text-center p-4">
            <CreditCard className="h-8 w-8 text-red-600 mb-2" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Gastos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">{`Gastos ${getTimeFilterLabelWithPreposition()}`}</p>
            <div className="text-xl sm:text-2xl font-bold">{stats.totalExpensesCount}</div>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base sm:text-lg">Actividad Reciente</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Últimas acciones realizadas en el sistema
                </CardDescription>
              </div>
              {refreshing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Actualizando...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  {loading ? 'Cargando actividad reciente...' : 'No hay actividad reciente'}
                </p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      activity.status === 'success' ? 'bg-success-600' :
                      activity.status === 'warning' ? 'bg-warning-600' :
                      'bg-blue-600'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-2 flex-shrink-0">
                    {activity.amount && (
                      <Badge variant={activity.status === 'success' ? 'success' : 'secondary'} className="text-xs">
                        {formatCurrency(activity.amount)}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </>
        )}
      </div>
  )
}
