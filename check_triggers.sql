-- VERIFICAR TRIGGERS QUE PUEDEN ESTAR DUPLICANDO MOVIMIENTOS

-- 1. Ver todos los triggers relacionados con inventario
SELECT 
    'TRIGGERS ACTIVOS:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%inventory%' 
   OR trigger_name LIKE '%stock%'
   OR action_statement LIKE '%inventory%'
ORDER BY trigger_name;

-- 2. Ver si hay triggers en la tabla invoices que afecten inventario
SELECT 
    'TRIGGERS EN INVOICES:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
ORDER BY trigger_name;

-- 3. Ver funciones que pueden estar siendo llamadas por triggers
SELECT 
    'FUNCIONES RELACIONADAS:' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'process_invoice_inventory',
    'validate_invoice_stock',
    'revert_invoice_inventory',
    'register_inventory_movement'
)
ORDER BY routine_name;

-- 4. Verificar si hay movimientos duplicados recientes
WITH duplicate_movements AS (
    SELECT 
        product_id,
        branch_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        COUNT(*) as occurrences
    FROM inventory_movements
    WHERE movement_date >= NOW() - INTERVAL '24 hours'
    GROUP BY product_id, branch_id, movement_type, quantity, reference_type, reference_id, movement_date
    HAVING COUNT(*) > 1
)
SELECT 
    'MOVIMIENTOS DUPLICADOS HOY:' as info,
    p.name as producto,
    dm.movement_type,
    dm.quantity,
    dm.occurrences as veces_repetido
FROM duplicate_movements dm
JOIN products p ON dm.product_id = p.id
ORDER BY dm.occurrences DESC;

-- Final: Revisar resultados para identificar posibles causas de duplicación
DO $$
BEGIN
    RAISE NOTICE '🔍 Revisa los resultados para identificar posibles causas de duplicación';
END $$;