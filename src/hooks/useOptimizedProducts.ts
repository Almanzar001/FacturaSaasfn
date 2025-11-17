import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'
import { usePagination } from './usePagination'

export interface OptimizedProduct {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  sku: string | null
  is_inventory_tracked: boolean
  unit_of_measure: string | null
}

export interface UseOptimizedProductsOptions {
  organizationId: string
  pageSize?: number
  searchDebounceMs?: number
}

export function useOptimizedProducts(options: UseOptimizedProductsOptions) {
  const { organizationId, pageSize = 50, searchDebounceMs = 500 } = options
  
  const [products, setProducts] = useState<OptimizedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, searchDebounceMs)
  
  // Pagination state
  const [pagination, paginationActions] = usePagination({ 
    initialPageSize: pageSize 
  })
  
  const supabase = createClient()

  const fetchProducts = useCallback(async (
    page: number, 
    size: number, 
    search?: string
  ) => {
    if (!organizationId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const offset = (page - 1) * size
      
      // Use optimized RPC function
      const { data, error } = await supabase
        .rpc('search_products', {
          org_id: organizationId,
          search_term: search || null,
          page_size: size,
          page_offset: offset
        })

      if (error) throw error

      if (data && data.length > 0) {
        setProducts(data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          sku: item.sku,
          is_inventory_tracked: item.is_inventory_tracked,
          unit_of_measure: item.unit_of_measure
        })))
        
        // Set total from the first row
        paginationActions.setTotal(data[0].total_count || 0)
      } else {
        setProducts([])
        paginationActions.setTotal(0)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setProducts([])
      paginationActions.setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase, paginationActions])

  // Fetch products when dependencies change
  useEffect(() => {
    fetchProducts(pagination.page, pagination.pageSize, debouncedSearchQuery)
  }, [fetchProducts, pagination.page, pagination.pageSize, debouncedSearchQuery])

  // Reset to first page when search query changes
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) return
    if (pagination.page !== 1) {
      paginationActions.setPage(1)
    }
  }, [debouncedSearchQuery, pagination.page, paginationActions, searchQuery])

  const refresh = useCallback(() => {
    fetchProducts(pagination.page, pagination.pageSize, debouncedSearchQuery)
  }, [fetchProducts, pagination.page, pagination.pageSize, debouncedSearchQuery])

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  return {
    products,
    loading,
    error,
    pagination,
    paginationActions,
    searchQuery,
    setSearch,
    refresh
  }
}