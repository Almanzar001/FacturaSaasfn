-- DIAGNOSTICAR POR QUÉ LOS TRIGGERS NO FUNCIONAN

-- 1. Ver la venta más reciente
SELECT 
    'VENTA MÁS RECIENTE:' as info,
    i.invoice_number,
    i.status,
    i.created_at,
    i.updated_at,
    ii.quantity as cantidad_vendida,
    p.name as producto,
    p.is_inventory_tracked
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY i.created_at DESC
LIMIT 2;

-- 2. Verificar si las funciones de trigger existen
SELECT 
    'FUNCIONES DE TRIGGER:' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'process_invoice_inventory',
    'validate_invoice_stock',
    'revert_invoice_inventory'
)
ORDER BY routine_name;

-- 3. Ver logs de Postgres para errores (si están disponibles)
-- Esto nos ayudará a ver si hay errores en los triggers

-- 4. Probar manualmente la función process_invoice_inventory
DO $$
DECLARE
    test_invoice_id UUID;
    old_record invoices%ROWTYPE;
    new_record invoices%ROWTYPE;
BEGIN
    -- Obtener la factura más reciente
    SELECT * INTO new_record
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    -- Simular OLD record con status diferente
    old_record := new_record;
    old_record.status := 'draft';
    
    RAISE NOTICE 'Probando función process_invoice_inventory manualmente...';
    RAISE NOTICE 'Factura: %, Status: %', new_record.invoice_number, new_record.status;
    
    -- Llamar función manualmente (esto simula lo que haría el trigger)
    -- Nota: No podemos llamar la función directamente aquí porque necesita el contexto del trigger
    
END $$;