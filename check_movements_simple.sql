-- Ver movimientos del producto Liquido Naranja 50ml
SELECT 
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