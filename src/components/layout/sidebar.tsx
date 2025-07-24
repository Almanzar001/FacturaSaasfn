'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Package,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  CreditCard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Facturas', href: '/facturas', icon: FileText },
  { name: 'Cotizaciones', href: '/cotizaciones', icon: Receipt },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Gastos', href: '/gastos', icon: CreditCard },
]

interface SidebarProps {
  className?: string
  userRole?: string
}

export function Sidebar({ className, userRole }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop sidebar - Hidden on mobile and tablet, only visible on large screens */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-300 z-30",
        collapsed ? "lg:w-16" : "lg:w-72",
        className
      )}>
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} userRole={userRole} />
      </div>
    </>
  )
}

interface SidebarContentProps {
  pathname: string
  collapsed: boolean
  onToggle?: () => void
  userRole?: string
}

function SidebarContent({ pathname, collapsed, onToggle, userRole }: SidebarContentProps) {
  const canViewSettings = userRole === 'propietario' || userRole === 'administrador'

  return (
    <div className="flex h-full min-h-0 flex-col bg-background border-r">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center border-b px-6">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="h-4 w-4" />
            </div>
            <span className="font-semibold">FacturaSaaS</span>
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn("ml-auto", collapsed && "mx-auto")}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-soft" 
                  : "text-muted-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary-foreground")} />
              {!collapsed && <span>{item.name}</span>}
              {collapsed && (
                <span className="sr-only">{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="space-y-1">
          {canViewSettings && (
            <Link
              href="/configuraciones"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                pathname.startsWith('/configuraciones') && "bg-accent",
                collapsed && "justify-center px-2"
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Configuración</span>}
            </Link>
          )}
          <button
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase/client');
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MobileSidebarProps {
  userRole?: string
}

export function MobileSidebar({ userRole }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="lg"
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
      >
        <Menu className="h-7 w-7 text-gray-700" />
        <span className="sr-only">Abrir menú</span>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-6 bg-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="font-semibold text-gray-900">FacturaSaaS</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Mobile Navigation Content */}
            <div className="flex h-full min-h-0 flex-col bg-white">
              <nav className="flex-1 space-y-1 p-4 bg-white">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100",
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-700 hover:text-gray-900"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-gray-500")} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile Footer */}
              <div className="border-t p-4 bg-white">
                <div className="space-y-1">
                  {(userRole === 'propietario' || userRole === 'administrador') && (
                    <Link
                      href="/configuraciones"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900",
                        pathname.startsWith('/configuraciones') && "bg-gray-100 text-gray-900"
                      )}
                    >
                      <Settings className="h-4 w-4 shrink-0 text-gray-500" />
                      <span>Configuración</span>
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      const { createClient } = await import('@/lib/supabase/client');
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900"
                  >
                    <LogOut className="h-4 w-4 shrink-0 text-gray-500" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}