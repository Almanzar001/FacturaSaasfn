import React, { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building, MapPin, Star } from 'lucide-react'

interface BranchSelectorProps {
  value?: string
  onValueChange: (branchId: string) => void
  placeholder?: string
  disabled?: boolean
  showAllOption?: boolean
  allOptionLabel?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showBranchInfo?: boolean
}

export function BranchSelector({
  value,
  onValueChange,
  placeholder = "Seleccionar sucursal",
  disabled = false,
  showAllOption = false,
  allOptionLabel = "Todas las sucursales",
  className = "",
  size = 'md',
  showBranchInfo = true
}: BranchSelectorProps) {
  const { assignedBranches, userRole, loading } = usePermissions()
  const [availableBranches, setAvailableBranches] = useState(assignedBranches)

  useEffect(() => {
    setAvailableBranches(assignedBranches)
  }, [assignedBranches])

  // Auto-seleccionar si solo hay una sucursal disponible
  useEffect(() => {
    if (!value && availableBranches.length === 1 && !showAllOption) {
      onValueChange(availableBranches[0].branch_id)
    }
  }, [availableBranches, value, onValueChange, showAllOption])

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 text-sm'
      case 'lg':
        return 'h-12 text-base'
      default:
        return 'h-10 text-sm'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-500">Cargando sucursales...</span>
      </div>
    )
  }

  // Si es propietario o administrador y no hay sucursales asignadas específicamente,
  // mostrar mensaje informativo
  if (availableBranches.length === 0 && (userRole === 'propietario' || userRole === 'administrador')) {
    return (
      <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4" />
          <span>Como {userRole}, tienes acceso a todas las sucursales</span>
        </div>
      </div>
    )
  }

  // Si no hay sucursales disponibles para otros roles
  if (availableBranches.length === 0) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4" />
          <span>No tienes sucursales asignadas. Contacta al administrador.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className={`${getSizeClasses()} ${className}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (userRole === 'propietario' || userRole === 'administrador') && (
            <SelectItem value="all">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-blue-600" />
                <span>{allOptionLabel}</span>
              </div>
            </SelectItem>
          )}
          
          {availableBranches.map((branch) => (
            <SelectItem key={branch.branch_id} value={branch.branch_id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{branch.branch_name}</span>
                      {branch.is_main && (
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      )}
                    </div>
                    {showBranchInfo && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span>{branch.branch_code}</span>
                        {branch.is_main && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            Principal
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Información adicional */}
      {showBranchInfo && value && value !== 'all' && (
        <div className="text-xs text-gray-500 flex items-center space-x-2">
          <MapPin className="h-3 w-3" />
          <span>
            Sucursal seleccionada: {availableBranches.find(b => b.branch_id === value)?.branch_name}
          </span>
        </div>
      )}
    </div>
  )
}

// Componente simplificado para casos específicos
export function SimpleBranchSelector({ 
  value, 
  onValueChange, 
  className = "" 
}: { 
  value?: string
  onValueChange: (branchId: string) => void
  className?: string 
}) {
  return (
    <BranchSelector
      value={value}
      onValueChange={onValueChange}
      placeholder="Sucursal"
      size="sm"
      showBranchInfo={false}
      className={className}
    />
  )
}

// Hook para obtener la sucursal seleccionada
export function useSelectedBranch(initialBranchId?: string) {
  const { assignedBranches, getDefaultBranch } = usePermissions()
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(initialBranchId)

  // Auto-seleccionar sucursal por defecto
  useEffect(() => {
    if (!selectedBranchId && assignedBranches.length > 0) {
      const defaultBranch = getDefaultBranch()
      if (defaultBranch) {
        setSelectedBranchId(defaultBranch.branch_id)
      }
    }
  }, [assignedBranches, selectedBranchId, getDefaultBranch])

  const selectedBranch = assignedBranches.find(b => b.branch_id === selectedBranchId)

  return {
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    availableBranches: assignedBranches
  }
}