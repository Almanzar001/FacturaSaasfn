-- VER TODAS LAS FACTURAS Y SUS MOVIMIENTOS

-- 1. Todas las facturas con el producto
SELECT 
    'FACTURAS:' as tipo,
    i.invoice_number,
    i.status,
    ii.quantity as vendido,
    i.created_at,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM inventory_movements im 
            WHERE im.reference_type = 'factura' 
            AND im.reference_id = i.id
        ) THEN '✅ Procesada'
        ELSE '❌ No procesada'
    END as estado_inventario
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY i.created_at;

-- 2. Todos los movimientos existentes
SELECT 
    'MOVIMIENTOS:' as tipo,
    im.movement_date,
    im.movement_type,
    im.quantity,
    im.reference_type,
    COALESCE(i.invoice_number, 'Sin factura') as factura_relacionada,
    im.notes
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
LEFT JOIN invoices i ON im.reference_id = i.id AND im.reference_type = 'factura'
WHERE p.name = 'Liquido Naranja 50ml'
ORDER BY im.movement_date;

-- 3. Cálculo manual del stock
SELECT 
    'CÁLCULO STOCK:' as tipo,
    SUM(im.quantity) as stock_calculado_movimientos,
    (SELECT quantity FROM inventory_stock iss 
     JOIN products p ON iss.product_id = p.id 
     WHERE p.name = 'Liquido Naranja 50ml') as stock_registrado,
    SUM(CASE WHEN ii.invoice_id IS NOT NULL THEN ii.quantity ELSE 0 END) as total_vendido_facturas
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
LEFT JOIN invoices i ON im.reference_id = i.id AND im.reference_type = 'factura'
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id AND ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';