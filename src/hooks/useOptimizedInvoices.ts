import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'
import { usePagination } from './usePagination'

export interface OptimizedInvoice {
  id: string
  invoice_number: string
  client_name: string
  client_email: string
  total: number
  status: string
  issue_date: string
  due_date: string
  created_at: string
}

export interface UseOptimizedInvoicesOptions {
  organizationId: string
  pageSize?: number
  searchDebounceMs?: number
}

export function useOptimizedInvoices(options: UseOptimizedInvoicesOptions) {
  const { organizationId, pageSize = 50, searchDebounceMs = 500 } = options
  
  const [invoices, setInvoices] = useState<OptimizedInvoice[]>([])
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

  const fetchInvoices = useCallback(async (
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
        .rpc('get_invoices_paginated', {
          org_id: organizationId,
          page_size: size,
          page_offset: offset,
          search_term: search || null
        })

      if (error) throw error

      if (data && data.length > 0) {
        setInvoices(data.map(item => ({
          id: item.id,
          invoice_number: item.invoice_number,
          client_name: item.client_name,
          client_email: item.client_email,
          total: item.total,
          status: item.status,
          issue_date: item.issue_date,
          due_date: item.due_date,
          created_at: item.created_at
        })))
        
        // Set total from the first row (all rows have the same total_count)
        paginationActions.setTotal(data[0].total_count || 0)
      } else {
        setInvoices([])
        paginationActions.setTotal(0)
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setInvoices([])
      paginationActions.setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase, paginationActions])

  // Fetch invoices when page, page size, or search query changes
  useEffect(() => {
    fetchInvoices(pagination.page, pagination.pageSize, debouncedSearchQuery)
  }, [fetchInvoices, pagination.page, pagination.pageSize, debouncedSearchQuery])

  // Reset to first page when search query changes
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) return
    if (pagination.page !== 1) {
      paginationActions.setPage(1)
    }
  }, [debouncedSearchQuery, pagination.page, paginationActions, searchQuery])

  const refresh = useCallback(() => {
    fetchInvoices(pagination.page, pagination.pageSize, debouncedSearchQuery)
  }, [fetchInvoices, pagination.page, pagination.pageSize, debouncedSearchQuery])

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  return {
    invoices,
    loading,
    error,
    pagination,
    paginationActions,
    searchQuery,
    setSearch,
    refresh
  }
}