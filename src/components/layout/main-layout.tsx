'use client'

import { User } from '@supabase/supabase-js'
import { Sidebar, MobileSidebar } from './sidebar'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
  user?: User
  userRole?: string
  className?: string
}

export function MainLayout({ children, user, userRole, className }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-bg">
      <Sidebar userRole={userRole} />
      
      <div className="lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-soft lg:hidden">
          <MobileSidebar>
            <nav className="flex-1 space-y-1 p-4">
              {/* Mobile navigation items */}
            </nav>
          </MobileSidebar>
          
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className={cn("animate-fade-in", className)}>
          {children}
        </main>
      </div>
    </div>
  )
}