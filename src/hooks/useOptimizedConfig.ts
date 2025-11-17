import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ConfigData {
  organization: any
  documentTypes: any[]
  accounts: any[]
  branches: any[]
  clients: any[]
  products: any[]
}

export interface UseOptimizedConfigOptions {
  organizationId: string
  includeClients?: boolean
  includeProducts?: boolean
  cacheTimeMs?: number
}

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number, ttl: number }>()

const getCacheKey = (orgId: string, options: UseOptimizedConfigOptions): string => {
  return `config-${orgId}-${JSON.stringify(options)}`
}

const getFromCache = (key: string) => {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  cache.delete(key)
  return null
}

const setCache = (key: string, data: any, ttl: number) => {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

export function useOptimizedConfig(options: UseOptimizedConfigOptions) {
  const { 
    organizationId, 
    includeClients = false, 
    includeProducts = false,
    cacheTimeMs = 5 * 60 * 1000 // 5 minutes default cache
  } = options
  
  const [data, setData] = useState<Partial<ConfigData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()
  const cacheKey = getCacheKey(organizationId, options)

  const fetchConfigData = useCallback(async () => {
    if (!organizationId) return

    // Check cache first
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      setData(cachedData)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Paralelizar todas las consultas necesarias
      const queries = [
        // Organization
        supabase
          .from('organizations')
          .select('*')
          .eq('id', organizationId)
          .single(),
        
        // Document Types
        supabase
          .from('document_types')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        
        // Accounts
        supabase
          .from('accounts')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        
        // Branches
        supabase
          .from('branches')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name')
      ]

      // Add optional queries
      if (includeClients) {
        queries.push(
          supabase
            .from('clients')
            .select('id, name, email, phone')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('name')
            .limit(1000) // Limit to avoid performance issues
        )
      }

      if (includeProducts) {
        queries.push(
          supabase
            .from('products')
            .select('id, name, price, sku, is_inventory_tracked')
            .eq('organization_id', organizationId)
            .order('name')
            .limit(1000) // Limit to avoid performance issues
        )
      }

      // Execute all queries in parallel
      const results = await Promise.allSettled(queries)
      
      // Process results
      const configData: Partial<ConfigData> = {}
      let hasErrors = false

      // Organization
      const orgResult = results[0]
      if (orgResult.status === 'fulfilled' && !orgResult.value.error) {
        configData.organization = orgResult.value.data
      } else {
        console.error('Error fetching organization:', orgResult)
        hasErrors = true
      }

      // Document Types
      const docTypesResult = results[1]
      if (docTypesResult.status === 'fulfilled' && !docTypesResult.value.error) {
        configData.documentTypes = docTypesResult.value.data || []
      } else {
        console.error('Error fetching document types:', docTypesResult)
        configData.documentTypes = []
      }

      // Accounts
      const accountsResult = results[2]
      if (accountsResult.status === 'fulfilled' && !accountsResult.value.error) {
        configData.accounts = accountsResult.value.data || []
      } else {
        console.error('Error fetching accounts:', accountsResult)
        configData.accounts = []
      }

      // Branches
      const branchesResult = results[3]
      if (branchesResult.status === 'fulfilled' && !branchesResult.value.error) {
        configData.branches = branchesResult.value.data || []
      } else {
        console.error('Error fetching branches:', branchesResult)
        configData.branches = []
      }

      // Clients (optional)
      if (includeClients && results[4]) {
        const clientsResult = results[4]
        if (clientsResult.status === 'fulfilled' && !clientsResult.value.error) {
          configData.clients = clientsResult.value.data || []
        } else {
          console.error('Error fetching clients:', clientsResult)
          configData.clients = []
        }
      }

      // Products (optional)
      const productIndex = includeClients ? 5 : 4
      if (includeProducts && results[productIndex]) {
        const productsResult = results[productIndex]
        if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
          configData.products = productsResult.value.data || []
        } else {
          console.error('Error fetching products:', productsResult)
          configData.products = []
        }
      }

      // Only cache if no critical errors (organization data is present)
      if (!hasErrors && configData.organization) {
        setCache(cacheKey, configData, cacheTimeMs)
      }

      setData(configData)

    } catch (err) {
      console.error('Error fetching config data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [organizationId, includeClients, includeProducts, cacheKey, cacheTimeMs, supabase])

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchConfigData()
  }, [fetchConfigData])

  const refresh = useCallback(() => {
    // Clear cache and refetch
    cache.delete(cacheKey)
    fetchConfigData()
  }, [cacheKey, fetchConfigData])

  const clearCache = useCallback(() => {
    cache.clear()
  }, [])

  return {
    data,
    loading,
    error,
    refresh,
    clearCache
  }
}