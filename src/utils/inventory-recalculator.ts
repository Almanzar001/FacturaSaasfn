import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export interface RecalculationResult {
  productId: string
  productName: string
  branchId: string
  branchName: string
  oldStock: number
  newStock: number
  movementsProcessed: number
  corrected: boolean
}

/**
 * Recalcula todo el stock basado en movimientos históricos
 * Útil para corregir inconsistencias causadas por bugs previos
 */
export async function recalculateAllInventory(organizationId: string): Promise<RecalculationResult[]> {
  try {
    const results: RecalculationResult[] = []

    // Obtener todos los productos con inventario habilitado
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_inventory_tracked', true)

    // Obtener todas las sucursales
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)

    if (!products || !branches) return results

    // Procesar cada combinación producto-sucursal
    for (const product of products) {
      for (const branch of branches) {
        const result = await recalculateProductBranchStock(product.id, product.name, branch.id, branch.name)
        results.push(result)
      }
    }

    return results.filter(r => r.movementsProcessed > 0) // Solo mostrar productos con movimientos

  } catch (error) {
    console.error('Error en recálculo de inventario:', error)
    throw error
  }
}

/**
 * Recalcula el stock de un producto específico en una sucursal específica
 */
async function recalculateProductBranchStock(
  productId: string,
  productName: string,
  branchId: string,
  branchName: string
): Promise<RecalculationResult> {

  // Obtener stock actual
  const { data: currentStockData } = await supabase
    .from('inventory_stock')
    .select('quantity')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .single()

  const oldStock = currentStockData?.quantity || 0

  // Obtener todos los movimientos ordenados cronológicamente
  const { data: movements } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .order('movement_date', { ascending: true })

  let calculatedStock = 0
  let movementsProcessed = 0

  // Recalcular stock basado en movimientos
  for (const movement of movements || []) {
    // Usar la lógica corregida
    let quantityChange = movement.quantity

    // Validar que el movimiento sea consistente
    const expectedNew = movement.previous_quantity + quantityChange
    
    if (Math.abs(expectedNew - movement.new_quantity) > 0.01) {
      console.warn(`Movimiento inconsistente detectado: ${movement.id}`)
      console.warn(`${movement.previous_quantity} + ${quantityChange} ≠ ${movement.new_quantity}`)
    }

    calculatedStock = movement.new_quantity
    movementsProcessed++
  }

  const needsCorrection = Math.abs(oldStock - calculatedStock) > 0.01
  
  // Actualizar stock si es necesario
  if (needsCorrection && movementsProcessed > 0) {
    await supabase
      .from('inventory_stock')
      .upsert({
        product_id: productId,
        branch_id: branchId,
        quantity: calculatedStock,
        reserved_quantity: 0,
        last_movement_date: new Date().toISOString()
      }, {
        onConflict: 'product_id,branch_id'
      })
  }

  return {
    productId,
    productName,
    branchId,
    branchName,
    oldStock,
    newStock: calculatedStock,
    movementsProcessed,
    corrected: needsCorrection
  }
}

/**
 * Elimina movimientos duplicados o inconsistentes
 */
export async function cleanupInconsistentMovements(organizationId: string): Promise<{ deleted: number; errors: string[] }> {
  try {
    let deleted = 0
    const errors: string[] = []

    // Esta función podría implementar lógica para:
    // 1. Detectar movimientos duplicados
    // 2. Eliminar movimientos que rompan la secuencia lógica
    // 3. Corregir movimientos con cálculos incorrectos

    // Por ahora, solo retornamos el contador
    return { deleted, errors }

  } catch (error) {
    return { deleted: 0, errors: [(error as any)?.message || 'Error desconocido'] }
  }
}