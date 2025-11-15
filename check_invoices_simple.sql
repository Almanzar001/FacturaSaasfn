-- Ver facturas con el producto Liquido Naranja 50ml
SELECT 
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