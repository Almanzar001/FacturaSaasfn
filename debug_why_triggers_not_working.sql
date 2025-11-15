-- DIAGNOSTICAR POR QUÉ LOS TRIGGERS NO FUNCIONAN

-- 1. Ver todas las facturas con el producto
SELECT 
    'FACTURAS CON LIQUIDO NARANJA:' as info,
    i.invoice_number,
    i.status,
    i.created_at,
    ii.quantity as cantidad_vendida,
    p.name as producto,
    p.is_inventory_tracked
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY i.created_at DESC;

-- 2. Ver todos los movimientos registrados
SELECT 
    'MOVIMIENTOS DE INVENTARIO:' as info,
    im.movement_date,
    im.movement_type,
    im.quantity,
    im.reference_type,
    im.reference_id,
    im.notes
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY im.movement_date DESC;

-- 3. Verificar si los triggers están realmente activos
SELECT 
    'ESTADO TRIGGERS:' as info,
    trigger_name,
    action_statement,
    action_condition
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%'
ORDER BY trigger_name;

-- 4. Probar manualmente con la factura más reciente
DO $$
DECLARE
    latest_invoice RECORD;
    org_id UUID;
    inventory_enabled BOOLEAN;
    branch_id UUID;
BEGIN
    -- Obtener la factura más reciente
    SELECT i.* INTO latest_invoice
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    RAISE NOTICE '=== DIAGNÓSTICO FACTURA: % ===', latest_invoice.invoice_number;
    RAISE NOTICE 'Status: %', latest_invoice.status;
    RAISE NOTICE 'Organization ID: %', latest_invoice.organization_id;
    RAISE NOTICE 'Branch ID: %', latest_invoice.branch_id;
    
    -- Verificar configuración de inventario
    SELECT s.inventory_enabled INTO inventory_enabled
    FROM inventory_settings s
    WHERE s.organization_id = latest_invoice.organization_id;
    
    RAISE NOTICE 'Inventario habilitado: %', COALESCE(inventory_enabled, FALSE);
    
    -- Verificar sucursal
    IF latest_invoice.branch_id IS NULL THEN
        SELECT id INTO branch_id
        FROM branches
        WHERE organization_id = latest_invoice.organization_id AND is_main = TRUE
        LIMIT 1;
        RAISE NOTICE 'Sucursal principal: %', branch_id;
    ELSE
        RAISE NOTICE 'Sucursal de factura: %', latest_invoice.branch_id;
    END IF;
    
    -- Ver si hay movimiento de inventario para esta factura
    IF EXISTS (
        SELECT 1 FROM inventory_movements 
        WHERE reference_type = 'factura' 
        AND reference_id = latest_invoice.id
    ) THEN
        RAISE NOTICE '✅ Ya tiene movimiento de inventario registrado';
    ELSE
        RAISE NOTICE '❌ NO tiene movimiento de inventario';
        RAISE NOTICE '🔧 Esto indica que los triggers no se ejecutaron';
    END IF;
    
END $$;

-- 5. Ver logs de errores si están disponibles
-- (Esto puede no funcionar en todos los entornos)
SELECT 
    'LOGS RECIENTES:' as info,
    NOW() - INTERVAL '1 hour' as desde,
    NOW() as hasta,
    'Buscar errores de triggers en logs de PostgreSQL' as accion;