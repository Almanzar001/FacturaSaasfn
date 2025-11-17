'use client'

import { useUserPermissions } from '@/hooks/useUserPermissions'
import { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PermissionGuardProps {
  children: ReactNode
  permission: string
  fallback?: ReactNode
  showError?: boolean
}

export function PermissionGuard({ 
  children, 
  permission, 
  fallback = null, 
  showError = true 
}: PermissionGuardProps) {
  const { hasPermission, loading } = useUserPermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!hasPermission(permission)) {
    if (fallback) return <>{fallback}</>
    
    if (showError) {
      return (
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex items-center space-x-4 p-6">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Acceso Restringido
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                No tienes permisos para acceder a esta sección.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }
    
    return null
  }

  return <>{children}</>
}

interface BranchGuardProps {
  children: ReactNode
  branchId: string
  fallback?: ReactNode
}

export function BranchGuard({ children, branchId, fallback = null }: BranchGuardProps) {
  const { assignedBranches, loading } = useUserPermissions()

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  const canAccess = assignedBranches.some(branch => branch.branch_id === branchId)

  if (!canAccess) {
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}