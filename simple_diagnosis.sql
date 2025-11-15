-- DIAGNÓSTICO SIMPLE

-- ¿Cuántas facturas tienes con el producto?
SELECT COUNT(*) as total_facturas
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';

-- ¿Cuántos movimientos de inventario tienes?
SELECT COUNT(*) as total_movimientos
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';

-- ¿Cuántas ventas fueron procesadas automáticamente?
SELECT COUNT(*) as ventas_procesadas_automaticamente
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
AND im.reference_type = 'factura'
AND im.movement_type = 'salida';