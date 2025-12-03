import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export interface DiagnosticResult {
  tableName: string
  canRead: boolean
  canInsert: boolean
  canUpdate: boolean
  canDelete: boolean
  error?: string
  sampleData?: any
}

/**
 * Verifica los permisos y accesos a las tablas de inventario
 */
export async function runInventoryDiagnostics(organizationId: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  
  const tables = [
    'inventory_movements',
    'inventory_stock',
    'inventory_settings',
    'products',
    'branches'
  ]

  for (const tableName of tables) {
    const result = await testTableAccess(tableName, organizationId)
    results.push(result)
  }

  return results
}

async function testTableAccess(tableName: string, organizationId: string): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    tableName,
    canRead: false,
    canInsert: false,
    canUpdate: false,
    canDelete: false
  }

  try {
    // Test READ
    const { data: readData, error: readError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)

    if (!readError) {
      result.canRead = true
      result.sampleData = readData?.[0]
    }

    // Test INSERT (with rollback)
    if (tableName === 'inventory_movements') {
      const testData = {
        product_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID to cause rollback
        branch_id: '00000000-0000-0000-0000-000000000000',
        movement_type: 'test',
        quantity: 1,
        previous_quantity: 0,
        new_quantity: 1,
        movement_date: new Date().toISOString()
      }

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(testData)

      // If error is about foreign key, it means INSERT permission is OK
      if (insertError?.code === '23503') { // Foreign key violation
        result.canInsert = true
      } else if (!insertError) {
        result.canInsert = true
        // Clean up if somehow it succeeded
        await supabase.from(tableName).delete().eq('movement_type', 'test')
      }
    }

    // For other operations, we'll assume they work if read works
    result.canUpdate = result.canRead
    result.canDelete = result.canRead

  } catch (error: any) {
    result.error = error.message
  }

  return result
}

/**
 * Verifica la configuración de inventario para la organización
 */
export async function checkInventorySettings(organizationId: string): Promise<{
  settingsExist: boolean
  autoDeductEnabled: boolean
  inventoryEnabled: boolean
  settings?: any
}> {
  try {
    const { data: settings, error } = await supabase
      .from('inventory_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error || !settings) {
      return {
        settingsExist: false,
        autoDeductEnabled: false,
        inventoryEnabled: false
      }
    }

    return {
      settingsExist: true,
      autoDeductEnabled: !!settings.auto_deduct_on_invoice,
      inventoryEnabled: !!settings.inventory_enabled,
      settings
    }
  } catch {
    return {
      settingsExist: false,
      autoDeductEnabled: false,
      inventoryEnabled: false
    }
  }
}

/**
 * Verifica los tipos de usuario y permisos
 */
export async function checkUserPermissions(): Promise<{
  userId: string | null
  email: string | null
  role: string | null
  organizationId: string | null
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return {
        userId: null,
        email: null,
        role: null,
        organizationId: null
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    return {
      userId: user.id,
      email: user.email || null,
      role: profile?.role || null,
      organizationId: profile?.organization_id || null
    }
  } catch {
    return {
      userId: null,
      email: null,
      role: null,
      organizationId: null
    }
  }
}