-- VERIFICAR MOVIMIENTOS Y VENTAS

-- 1. Ver todos los movimientos del producto
SELECT 
    'TODOS LOS MOVIMIENTOS:' as info,
    im.movement_date,
    im.movement_type,
    im.quantity,
    im.previous_quantity,
    im.new_quantity,
    im.reference_type,
    im.notes
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY im.movement_date;

-- 2. Ver facturas del producto para verificar si las ventas se procesaron
SELECT 
    'FACTURAS CON EL PRODUCTO:' as info,
    i.invoice_number,
    i.status,
    i.created_at,
    ii.quantity as cantidad_vendida,
    ii.unit_price
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY i.created_at DESC;

-- 3. Verificar configuración de inventario
SELECT 
    'CONFIGURACIÓN INVENTARIO:' as info,
    inventory_enabled,
    auto_deduct_on_invoice,
    require_stock_validation
FROM inventory_settings
WHERE organization_id = (
    SELECT organization_id 
    FROM products 
    WHERE name = 'Liquido Naranja 50ml' 
    LIMIT 1
);

-- 4. Verificar si hay triggers activos
SELECT 
    'TRIGGERS DE INVENTARIO:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%inventory%'
   OR trigger_name LIKE '%stock%'
ORDER BY trigger_name;