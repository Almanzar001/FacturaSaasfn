import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export interface InventoryAuditResult {
  productId: string
  productName: string
  branchId: string
  branchName: string
  currentStock: number
  calculatedStock: number
  difference: number
  movements: any[]
  hasDiscrepancy: boolean
}

export interface AuditSummary {
  totalProducts: number
  discrepancies: number
  totalMovements: number
  results: InventoryAuditResult[]
}

/**
 * Audita el inventario comparando el stock actual vs el calculado desde movimientos
 */
export async function auditInventory(organizationId: string): Promise<AuditSummary> {
  try {
    // Obtener todos los productos con inventario habilitado
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, is_inventory_tracked')
      .eq('organization_id', organizationId)
      .eq('is_inventory_tracked', true)

    if (productsError) throw productsError

    // Obtener todas las sucursales
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)

    if (branchesError) throw branchesError

    const results: InventoryAuditResult[] = []
    let totalMovements = 0
    let discrepancies = 0

    // Auditar cada combinación producto-sucursal
    for (const product of products || []) {
      for (const branch of branches || []) {
        const auditResult = await auditProductBranch(product.id, product.name, branch.id, branch.name)
        results.push(auditResult)
        totalMovements += auditResult.movements.length
        
        if (auditResult.hasDiscrepancy) {
          discrepancies++
        }
      }
    }

    return {
      totalProducts: (products?.length || 0) * (branches?.length || 0),
      discrepancies,
      totalMovements,
      results: results.filter(r => r.movements.length > 0 || r.currentStock !== 0)
    }
  } catch (error) {
    console.error('Error en auditoría de inventario:', error)
    throw error
  }
}

/**
 * Audita un producto específico en una sucursal específica
 */
async function auditProductBranch(
  productId: string, 
  productName: string, 
  branchId: string, 
  branchName: string
): Promise<InventoryAuditResult> {
  
  // Obtener stock actual
  const { data: stockData } = await supabase
    .from('inventory_stock')
    .select('quantity')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .single()

  const currentStock = stockData?.quantity || 0

  // Obtener todos los movimientos para este producto/sucursal
  const { data: movements } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .order('movement_date', { ascending: true })

  // Calcular stock desde movimientos
  let calculatedStock = 0
  
  for (const movement of movements || []) {
    // Validar que previous_quantity + quantity = new_quantity
    const expectedNew = movement.previous_quantity + movement.quantity
    
    if (Math.abs(expectedNew - movement.new_quantity) > 0.01) {
      console.warn(`Inconsistencia en movimiento ${movement.id}: ${movement.previous_quantity} + ${movement.quantity} ≠ ${movement.new_quantity}`)
    }
    
    calculatedStock = movement.new_quantity
  }

  const difference = currentStock - calculatedStock
  const hasDiscrepancy = Math.abs(difference) > 0.01

  return {
    productId,
    productName,
    branchId,
    branchName,
    currentStock,
    calculatedStock,
    difference,
    movements: movements || [],
    hasDiscrepancy
  }
}

/**
 * Corrige las discrepancias encontradas ajustando el stock actual al calculado
 */
export async function fixInventoryDiscrepancies(
  results: InventoryAuditResult[],
  organizationId: string
): Promise<{ fixed: number; errors: string[] }> {
  let fixed = 0
  const errors: string[] = []

  for (const result of results.filter(r => r.hasDiscrepancy)) {
    try {
      // Actualizar stock a la cantidad calculada
      const { error } = await supabase
        .from('inventory_stock')
        .upsert({
          product_id: result.productId,
          branch_id: result.branchId,
          quantity: result.calculatedStock,
          reserved_quantity: 0,
          last_movement_date: new Date().toISOString()
        }, {
          onConflict: 'product_id,branch_id'
        })

      if (error) {
        errors.push(`Error corrigiendo ${result.productName} en ${result.branchName}: ${error.message}`)
      } else {
        // Registrar movimiento de ajuste si hay diferencia significativa
        if (Math.abs(result.difference) > 0.01) {
          await supabase
            .from('inventory_movements')
            .insert({
              product_id: result.productId,
              branch_id: result.branchId,
              movement_type: 'ajuste',
              quantity: result.difference, // La diferencia que se está corrigiendo
              previous_quantity: result.currentStock,
              new_quantity: result.calculatedStock,
              reference_type: 'auditoria',
              reference_id: null,
              notes: `Ajuste automático por auditoría. Diferencia: ${result.difference}`,
              movement_date: new Date().toISOString()
            })
        }
        
        fixed++
      }
    } catch (error) {
      errors.push(`Error procesando ${result.productName}: ${(error as any)?.message}`)
    }
  }

  return { fixed, errors }
}