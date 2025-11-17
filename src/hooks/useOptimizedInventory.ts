import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'
import { usePagination } from './usePagination'

export interface OptimizedMovement {
  id: string
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  product_name: string
  product_sku: string | null
  branch_name: string
  movement_date: string
  notes: string | null
}

export interface UseOptimizedInventoryOptions {
  organizationId: string
  pageSize?: number
  searchDebounceMs?: number
}

export interface InventoryFilters {
  branchId?: string
  movementType?: string
  dateFrom?: string
  dateTo?: string
}

export function useOptimizedInventory(options: UseOptimizedInventoryOptions) {
  const { organizationId, pageSize = 50, searchDebounceMs = 500 } = options
  
  const [movements, setMovements] = useState<OptimizedMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<InventoryFilters>({})
  
  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, searchDebounceMs)
  
  // Pagination state
  const [pagination, paginationActions] = usePagination({ 
    initialPageSize: pageSize 
  })
  
  const supabase = createClient()

  const fetchMovements = useCallback(async (
    page: number, 
    size: number, 
    search?: string,
    currentFilters?: InventoryFilters
  ) => {
    if (!organizationId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const offset = (page - 1) * size
      
      // Use optimized RPC function
      const { data, error } = await supabase
        .rpc('get_inventory_movements_paginated', {
          org_id: organizationId,
          page_size: size,
          page_offset: offset,
          search_term: search || null,
          branch_filter: currentFilters?.branchId || null
        })

      if (error) throw error

      if (data && data.length > 0) {
        setMovements(data.map(item => ({
          id: item.id,
          movement_type: item.movement_type,
          quantity: item.quantity,
          previous_quantity: item.previous_quantity,
          new_quantity: item.new_quantity,
          product_name: item.product_name,
          product_sku: item.product_sku,
          branch_name: item.branch_name,
          movement_date: item.movement_date,
          notes: item.notes
        })))
        
        // Set total from the first row
        paginationActions.setTotal(data[0].total_count || 0)
      } else {
        setMovements([])
        paginationActions.setTotal(0)
      }
    } catch (err) {
      console.error('Error fetching inventory movements:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setMovements([])
      paginationActions.setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase, paginationActions])

  // Fetch movements when dependencies change
  useEffect(() => {
    fetchMovements(pagination.page, pagination.pageSize, debouncedSearchQuery, filters)
  }, [fetchMovements, pagination.page, pagination.pageSize, debouncedSearchQuery, filters])

  // Reset to first page when search query or filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      paginationActions.setPage(1)
    }
  }, [debouncedSearchQuery, filters, pagination.page, paginationActions])

  const refresh = useCallback(() => {
    fetchMovements(pagination.page, pagination.pageSize, debouncedSearchQuery, filters)
  }, [fetchMovements, pagination.page, pagination.pageSize, debouncedSearchQuery, filters])

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const updateFilters = useCallback((newFilters: Partial<InventoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return {
    movements,
    loading,
    error,
    pagination,
    paginationActions,
    searchQuery,
    setSearch,
    filters,
    updateFilters,
    clearFilters,
    refresh
  }
}