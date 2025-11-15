-- REGISTRAR MOVIMIENTO DE VENTA FALTANTE
-- Vamos a registrar manualmente la venta de 20 unidades que no se procesó automáticamente

DO $$
DECLARE
    product_uuid UUID;
    branch_uuid UUID;
    invoice_uuid UUID;
    movement_uuid UUID;
BEGIN
    -- Obtener ID del producto
    SELECT id INTO product_uuid 
    FROM products 
    WHERE name = 'Liquido Naranja 50ml' 
    LIMIT 1;
    
    -- Obtener ID de la sucursal principal
    SELECT b.id INTO branch_uuid
    FROM branches b
    JOIN organizations o ON b.organization_id = o.id
    WHERE b.is_main = TRUE
    AND o.id = (SELECT organization_id FROM products WHERE id = product_uuid)
    LIMIT 1;
    
    -- Obtener ID de la factura
    SELECT i.id INTO invoice_uuid
    FROM invoices i
    WHERE i.invoice_number = 'CG0000000001'
    LIMIT 1;
    
    RAISE NOTICE 'Producto ID: %', product_uuid;
    RAISE NOTICE 'Sucursal ID: %', branch_uuid;
    RAISE NOTICE 'Factura ID: %', invoice_uuid;
    
    -- Registrar el movimiento de salida que faltaba
    SELECT register_inventory_movement(
        product_uuid,
        branch_uuid,
        'salida',
        -20,  -- Cantidad negativa para salida
        'factura',
        invoice_uuid,
        100.00,
        'Venta automática - Factura #CG0000000001 (registrada manualmente)'
    ) INTO movement_uuid;
    
    RAISE NOTICE '✅ Movimiento de venta registrado con ID: %', movement_uuid;
    RAISE NOTICE '📦 Stock debería ser ahora: 80 unidades (100 - 20)';
    
END $$;

-- Verificar el resultado
SELECT 
    'VERIFICACIÓN FINAL:' as info,
    p.name as producto,
    b.name as sucursal,
    iss.quantity as stock_actual
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
JOIN branches b ON iss.branch_id = b.id
WHERE p.name = 'Liquido Naranja 50ml';

-- Ver todos los movimientos ahora
SELECT 
    'MOVIMIENTOS COMPLETOS:' as info,
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