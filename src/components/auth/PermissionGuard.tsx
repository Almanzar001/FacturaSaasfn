import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { AlertCircle, Lock } from 'lucide-react'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredRole?: string[]
  requiredModule?: string
  branchId?: string
  fallback?: React.ReactNode
  showFallback?: boolean
  onPermissionDenied?: () => void
}

export function PermissionGuard({
  children,
  requiredPermission,
  requiredRole,
  requiredModule,
  branchId,
  fallback,
  showFallback = true,
  onPermissionDenied
}: PermissionGuardProps) {
  const { 
    hasPermission, 
    hasModuleAccess, 
    canAccessBranch, 
    userRole, 
    loading 
  } = usePermissions()

  // Mostrar loading mientras se obtienen permisos
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Verificando permisos...</span>
      </div>
    )
  }

  // Verificar rol específico
  if (requiredRole && requiredRole.length > 0) {
    if (!requiredRole.includes(userRole)) {
      if (onPermissionDenied) onPermissionDenied()
      
      if (!showFallback) return null
      
      return fallback || (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              Se requiere rol: {requiredRole.join(' o ')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tu rol actual: {userRole}
            </p>
          </div>
        </div>
      )
    }
  }

  // Verificar permiso específico
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      if (onPermissionDenied) onPermissionDenied()
      
      if (!showFallback) return null
      
      return fallback || (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              No tienes permiso para acceder a esta funcionalidad
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Permiso requerido: {requiredPermission}
            </p>
          </div>
        </div>
      )
    }
  }

  // Verificar acceso al módulo
  if (requiredModule) {
    if (!hasModuleAccess(requiredModule)) {
      if (onPermissionDenied) onPermissionDenied()
      
      if (!showFallback) return null
      
      return fallback || (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              No tienes acceso al módulo: {requiredModule}
            </p>
          </div>
        </div>
      )
    }
  }

  // Verificar acceso a sucursal específica
  if (branchId) {
    if (!canAccessBranch(branchId)) {
      if (onPermissionDenied) onPermissionDenied()
      
      if (!showFallback) return null
      
      return fallback || (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              No tienes acceso a esta sucursal
            </p>
          </div>
        </div>
      )
    }
  }

  // Si pasa todas las verificaciones, mostrar el contenido
  return <>{children}</>
}

// Hook auxiliar para usar en componentes
export function usePermissionGuard() {
  const permissions = usePermissions()
  
  const checkAccess = React.useCallback((options: {
    requiredPermission?: string
    requiredRole?: string[]
    requiredModule?: string
    branchId?: string
  }): boolean => {
    const { requiredPermission, requiredRole, requiredModule, branchId } = options
    
    if (requiredRole && requiredRole.length > 0) {
      if (!requiredRole.includes(permissions.userRole)) {
        return false
      }
    }
    
    if (requiredPermission && !permissions.hasPermission(requiredPermission)) {
      return false
    }
    
    if (requiredModule && !permissions.hasModuleAccess(requiredModule)) {
      return false
    }
    
    if (branchId && !permissions.canAccessBranch(branchId)) {
      return false
    }
    
    return true
  }, [permissions])
  
  return {
    ...permissions,
    checkAccess
  }
}

// Componentes específicos para casos comunes
export function AdminOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGuard 
      requiredRole={['propietario', 'administrador']}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}

export function ManagerOrAbove({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGuard 
      requiredRole={['propietario', 'administrador', 'gerente_sucursal']}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}

export function InvoiceAccess({ children, branchId, fallback }: { 
  children: React.ReactNode, 
  branchId?: string,
  fallback?: React.ReactNode 
}) {
  return (
    <PermissionGuard 
      requiredModule="facturas"
      branchId={branchId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}

export function InventoryAccess({ children, branchId, fallback }: { 
  children: React.ReactNode, 
  branchId?: string,
  fallback?: React.ReactNode 
}) {
  return (
    <PermissionGuard 
      requiredModule="inventario"
      branchId={branchId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  )
}