import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  showPageSizeSelector?: boolean
  pageSizeOptions?: number[]
  loading?: boolean
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = true,
  pageSizeOptions = [25, 50, 100, 200],
  loading = false,
  className = ""
}: PaginationProps) {
  const startItem = totalPages === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const canPrevious = currentPage > 1 && !loading
  const canNext = currentPage < totalPages && !loading

  // Generate page numbers to show
  const getVisiblePages = (): number[] => {
    const delta = 2 // Number of pages to show on each side of current page
    const range = []
    const rangeWithDots = []

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i)
      }
    }

    let prev = 0
    for (const i of range) {
      if (prev + 1 !== i) {
        rangeWithDots.push(-1) // -1 represents dots
      }
      rangeWithDots.push(i)
      prev = i
    }

    return rangeWithDots
  }

  const visiblePages = getVisiblePages()

  if (totalPages <= 1 && !showPageSizeSelector) {
    return null
  }

  return (
    <div className={`flex items-center justify-between space-x-6 lg:space-x-8 ${className}`}>
      {/* Items info and page size selector */}
      <div className="flex items-center space-x-4">
        <div className="text-sm text-muted-foreground">
          {total === 0 ? (
            "No hay elementos"
          ) : (
            <>Mostrando {startItem} a {endItem} de {total.toLocaleString()} elementos</>
          )}
        </div>
        
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Elementos por página:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
              disabled={loading}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Navigation controls */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
          {/* First page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!canPrevious}
            className="hidden md:flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-2">Anterior</span>
          </Button>

          {/* Page numbers */}
          <div className="hidden md:flex items-center space-x-1">
            {visiblePages.map((page, index) => (
              page === -1 ? (
                <span key={`dots-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  disabled={loading}
                  className="w-10"
                >
                  {page}
                </Button>
              )
            ))}
          </div>

          {/* Mobile page indicator */}
          <div className="md:hidden flex items-center space-x-2">
            <span className="text-sm font-medium">
              Página {currentPage} de {totalPages}
            </span>
          </div>

          {/* Next page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
          >
            <span className="sr-only md:not-sr-only md:mr-2">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!canNext}
            className="hidden md:flex"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}