import { useState, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
  offset: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginationActions {
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setTotal: (total: number) => void
  nextPage: () => void
  prevPage: () => void
  resetPagination: () => void
}

export interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
}

export function usePagination(options: UsePaginationOptions = {}): [PaginationState, PaginationActions] {
  const { initialPage = 1, initialPageSize = 50 } = options
  
  const [page, setPageState] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [total, setTotalState] = useState(0)

  const totalPages = Math.ceil(total / pageSize)
  const offset = (page - 1) * pageSize
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  const setPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPageState(newPage)
    }
  }, [totalPages])

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize)
    setPageState(1) // Reset to first page when changing page size
  }, [])

  const setTotal = useCallback((newTotal: number) => {
    setTotalState(newTotal)
    // Adjust current page if it exceeds new total pages
    const newTotalPages = Math.ceil(newTotal / pageSize)
    if (page > newTotalPages && newTotalPages > 0) {
      setPageState(newTotalPages)
    }
  }, [page, pageSize])

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPageState(prev => prev + 1)
    }
  }, [hasNextPage])

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPageState(prev => prev - 1)
    }
  }, [hasPrevPage])

  const resetPagination = useCallback(() => {
    setPageState(initialPage)
    setPageSizeState(initialPageSize)
    setTotalState(0)
  }, [initialPage, initialPageSize])

  const state: PaginationState = {
    page,
    pageSize,
    total,
    totalPages,
    offset,
    hasNextPage,
    hasPrevPage
  }

  const actions: PaginationActions = {
    setPage,
    setPageSize,
    setTotal,
    nextPage,
    prevPage,
    resetPagination
  }

  return [state, actions]
}