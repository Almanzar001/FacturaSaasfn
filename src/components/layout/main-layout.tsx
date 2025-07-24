'use client'

import { User } from '@supabase/supabase-js'
import { Sidebar, MobileSidebar } from './sidebar'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

interface MainLayoutProps {
  children: React.ReactNode
  user?: User
  userRole?: string
  className?: string
}

export function MainLayout({ children, user, userRole, className }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Listen for sidebar collapse state changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-bg">
      <Sidebar userRole={userRole} />
      
      {/* Dynamic padding based on sidebar state - No padding on mobile/tablet, only on desktop */}
      <div className={cn(
        "transition-all duration-300",
        "lg:pl-72", // Desktop padding only when sidebar is visible
        "min-h-screen"
      )}>
        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background/95 backdrop-blur-sm px-4 shadow-sm lg:hidden">
          <MobileSidebar userRole={userRole} />
          
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <h1 className="text-lg font-semibold text-foreground truncate">FacturaSaaS</h1>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className={cn(
          "animate-fade-in",
          "p-4 sm:p-6 lg:p-8", // Responsive padding
          "max-w-full overflow-x-auto", // Prevent horizontal overflow
          className
        )}>
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}