-- DIAGNÓSTICO DEL PROBLEMA DE STOCK
-- Ejecutar este script en el SQL Editor de Supabase para diagnosticar

-- 1. Ver todos los movimientos de inventario recientes
SELECT 
    'MOVIMIENTOS RECIENTES:' as info,
    im.movement_date,
    p.name as producto,
    b.name as sucursal,
    im.movement_type,
    im.quantity,
    im.previous_quantity,
    im.new_quantity,
    im.reference_type,
    im.notes
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
JOIN branches b ON im.branch_id = b.id
ORDER BY im.movement_date DESC
LIMIT 20;

-- 2. Ver stock actual de todos los productos
SELECT 
    'STOCK ACTUAL:' as info,
    p.name as producto,
    b.name as sucursal,
    iss.quantity as stock_actual,
    iss.cost_price,
    iss.last_movement_date
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
JOIN branches b ON iss.branch_id = b.id
ORDER BY p.name;

-- 3. Ver si hay triggers activos
SELECT 
    'TRIGGERS ACTIVOS:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%inventory%' OR trigger_name LIKE '%stock%'
ORDER BY trigger_name;

-- 4. Verificar funciones relacionadas con inventario
SELECT 
    'FUNCIONES DE INVENTARIO:' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%inventory%' OR routine_name LIKE '%stock%' OR routine_name LIKE '%register%'
ORDER BY routine_name;

-- 5. Ver las facturas más recientes y sus items
SELECT 
    'FACTURAS RECIENTES:' as info,
    i.invoice_number,
    i.status,
    i.created_at,
    ii.quantity as cantidad_vendida,
    p.name as producto
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.is_inventory_tracked = TRUE
ORDER BY i.created_at DESC
LIMIT 10;

-- 6. Calcular stock teórico vs real para cada producto
WITH stock_calculated AS (
    SELECT 
        p.name as producto,
        b.name as sucursal,
        SUM(CASE 
            WHEN im.movement_type IN ('entrada', 'transferencia_entrada') THEN im.quantity
            WHEN im.movement_type IN ('salida', 'transferencia_salida') THEN -ABS(im.quantity)
            ELSE 0
        END) as stock_calculado
    FROM products p
    CROSS JOIN branches b
    LEFT JOIN inventory_movements im ON p.id = im.product_id AND b.id = im.branch_id
    WHERE p.is_inventory_tracked = TRUE
    GROUP BY p.id, p.name, b.id, b.name
)
SELECT 
    'COMPARACIÓN STOCK:' as info,
    sc.producto,
    sc.sucursal,
    sc.stock_calculado,
    COALESCE(iss.quantity, 0) as stock_registrado,
    (COALESCE(iss.quantity, 0) - sc.stock_calculado) as diferencia
FROM stock_calculated sc
LEFT JOIN inventory_stock iss ON sc.producto = (SELECT name FROM products WHERE id = iss.product_id)
    AND sc.sucursal = (SELECT name FROM branches WHERE id = iss.branch_id)
WHERE sc.stock_calculado != 0 OR iss.quantity IS NOT NULL
ORDER BY sc.producto;