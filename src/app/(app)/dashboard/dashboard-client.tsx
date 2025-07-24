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
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profile?.organization_id) {
        const { data, error } = await supabase.rpc('get_dashboard_stats', {
          org_id: profile.organization_id,
        });

        if (error) throw error;

        setStats({
          totalRevenue: data.totalRevenue,
          totalExpenses: data.totalExpenses,
          totalProfit: data.totalProfit,
          totalClients: data.totalClients,
          totalInvoices: data.totalInvoices,
          totalQuotes: data.totalQuotes,
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
      }
    } catch (error) {
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
        {trend && (
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
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido de vuelta, {user?.user_metadata.full_name || user?.email}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos Totales"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            color="text-success-600"
            trend={12}
            description="Ingresos del período actual"
          />
          <StatCard
            title="Egresos"
            value={formatCurrency(stats.totalExpenses)}
            icon={TrendingDown}
            color="text-error-600"
            trend={-5}
            description="Gastos y costos operativos"
          />
          <StatCard
            title="Ganancia Neta"
            value={formatCurrency(stats.totalProfit)}
            icon={BarChart3}
            color="text-primary-600"
            trend={18}
            description="Beneficio después de gastos"
          />
          <StatCard
            title="Clientes Activos"
            value={stats.totalClients}
            icon={Users}
            color="text-purple-600"
            trend={8}
            description="Clientes con actividad reciente"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                Facturas
              </CardTitle>
              <CardDescription>Estado de facturación actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
              <p className="text-xs text-muted-foreground">
                +12 nuevas este mes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-warning-600" />
                Cotizaciones
              </CardTitle>
              <CardDescription>Propuestas comerciales pendientes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuotes}</div>
              <p className="text-xs text-muted-foreground">
                85% tasa de conversión
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
              Últimas acciones realizadas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`h-2 w-2 rounded-full ${
                    activity.status === 'success' ? 'bg-success-600' :
                    activity.status === 'warning' ? 'bg-warning-600' :
                    'bg-blue-600'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {activity.amount && (
                    <Badge variant={activity.status === 'success' ? 'success' : 'secondary'}>
                      {formatCurrency(activity.amount)}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
  )
}
