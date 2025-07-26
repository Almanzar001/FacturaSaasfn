'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Users, DollarSign, TrendingUp, TrendingDown, FileText, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'


interface DashboardStats {
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  totalClients: number
  totalInvoices: number
  totalQuotes: number
  revenueTrend?: number
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

export default function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalClients: 0,
    totalInvoices: 0,
    totalQuotes: 0,
    revenueTrend: 0,
    expensesTrend: 0,
    profitTrend: 0,
    clientsTrend: 0,
    invoicesTrend: 0,
    quotesTrend: 0,
  })

  const [activities, setActivities] = useState<Activity[]>([])

  const [user, setUser] = useState<User | null>(null);

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

  const fetchDashboardData = async (user: User) => {
    const supabase = createClient();
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, onboarding_completed')
        .eq('id', user.id)
        .single();

      console.log('Profile data:', profile);

      if (profile?.organization_id) {
        // Try the new comparison function first
        let { data, error } = await supabase.rpc('get_dashboard_comparison_stats', {
          org_id: profile.organization_id,
        });

        // If the new function doesn't exist, fallback to the old one
        if (error && error.message?.includes('function get_dashboard_comparison_stats')) {
          console.log('Comparison function not available, falling back to basic stats');
          const fallbackResult = await supabase.rpc('get_dashboard_stats', {
            org_id: profile.organization_id,
          });
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        console.log('Dashboard stats:', { data, error });

        if (error) {
          console.error('Error fetching dashboard stats:', error);
          // Set default values for new organizations
          setStats({
            totalRevenue: 0,
            totalExpenses: 0,
            totalProfit: 0,
            totalClients: 0,
            totalInvoices: 0,
            totalQuotes: 0,
            revenueTrend: 0,
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
          totalRevenue: data.totalRevenue || 0,
          totalExpenses: data.totalExpenses || 0,
          totalProfit: data.totalProfit || 0,
          totalClients: data.totalClients || 0,
          totalInvoices: data.totalInvoices || 0,
          totalQuotes: data.totalQuotes || 0,
          revenueTrend: data.revenueTrend || 0,
          expensesTrend: data.expensesTrend || 0,
          profitTrend: data.profitTrend || 0,
          clientsTrend: data.clientsTrend || 0,
          invoicesTrend: data.invoicesTrend || 0,
          quotesTrend: data.quotesTrend || 0,
        });
        
        // Asegurarse de que `data.activities` sea un array antes de mapear
        const activitiesData = data.activities || [];
        const formattedActivities = activitiesData.map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp).toLocaleDateString('es-DO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        }));
        setActivities(formattedActivities);
      } else {
        console.log('No organization found for user');
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
      console.error('Error in fetchDashboardData:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(amount)
  }

  const StatCard = ({ title, value, icon: Icon, color, trend, description }: {
    title: string
    value: string | number
    icon: any
    color: string
    trend?: number
    description?: string
  }) => (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-medium">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && trend !== 0 && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
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
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Bienvenido de vuelta, {user?.user_metadata.full_name || user?.email}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos Totales"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            color="text-success-600"
            trend={stats.revenueTrend}
            description="Ingresos del período actual"
          />
          <StatCard
            title="Egresos"
            value={formatCurrency(stats.totalExpenses)}
            icon={TrendingDown}
            color="text-error-600"
            trend={stats.expensesTrend}
            description="Gastos y costos operativos"
          />
          <StatCard
            title="Ganancia Neta"
            value={formatCurrency(stats.totalProfit)}
            icon={BarChart3}
            color="text-primary-600"
            trend={stats.profitTrend}
            description="Beneficio después de gastos"
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

        {/* Additional Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                Facturas
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Facturas creadas este mes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.totalInvoices}</div>
              {stats.invoicesTrend !== undefined && stats.invoicesTrend !== 0 && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-warning-600" />
                Cotizaciones
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Cotizaciones creadas este mes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.totalQuotes}</div>
              {stats.quotesTrend !== undefined && stats.quotesTrend !== 0 && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
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
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Actividad Reciente</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Últimas acciones realizadas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
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
      </div>
  )
}
