-- CORREGIR STOCK DIRECTAMENTE BASADO EN TODAS LAS VENTAS

-- 1. Ver todas las facturas y cantidades exactas
SELECT 
    'DETALLE VENTAS:' as info,
    i.invoice_number,
    ii.quantity,
    i.status,
    i.created_at
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id  
JOIN products p ON ii.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml'
AND i.status IN ('paid', 'completed', 'pagada', 'completada')
ORDER BY i.created_at;

-- 2. Calcular el stock correcto
WITH stock_calculation AS (
    SELECT 
        -- Stock inicial (entradas - compras)
        (SELECT COALESCE(SUM(im.quantity), 0) 
         FROM inventory_movements im 
         JOIN products p ON im.product_id = p.id
         WHERE p.name = 'Liquido Naranja 50ml' 
         AND im.movement_type = 'entrada') as total_entradas,
         
        -- Total vendido en facturas pagadas  
        (SELECT COALESCE(SUM(ii.quantity), 0)
         FROM invoices i
         JOIN invoice_items ii ON i.id = ii.invoice_id
         JOIN products p ON ii.product_id = p.id  
         WHERE p.name = 'Liquido Naranja 50ml'
         AND i.status IN ('paid', 'completed', 'pagada', 'completada')) as total_vendido,
         
        -- Stock actual registrado
        (SELECT COALESCE(iss.quantity, 0)
         FROM inventory_stock iss
         JOIN products p ON iss.product_id = p.id
         WHERE p.name = 'Liquido Naranja 50ml') as stock_registrado
)
SELECT 
    'CÁLCULO CORRECTO:' as info,
    total_entradas as comprado,
    total_vendido as vendido_total,
    (total_entradas - total_vendido) as stock_correcto,
    stock_registrado as stock_actual_erroneo
FROM stock_calculation;

-- 3. Actualizar directamente el stock a la cantidad correcta
DO $$
DECLARE
    product_uuid UUID;
    branch_uuid UUID;
    total_entradas INTEGER;
    total_vendido INTEGER;
    stock_correcto INTEGER;
    stock_actual INTEGER;
BEGIN
    -- Obtener IDs
    SELECT id INTO product_uuid FROM products WHERE name = 'Liquido Naranja 50ml' LIMIT 1;
    SELECT b.id INTO branch_uuid 
    FROM branches b 
    JOIN products p ON b.organization_id = p.organization_id
    WHERE p.id = product_uuid AND b.is_main = TRUE LIMIT 1;
    
    -- Calcular entradas totales (compras)
    SELECT COALESCE(SUM(quantity), 0) INTO total_entradas
    FROM inventory_movements 
    WHERE product_id = product_uuid AND movement_type = 'entrada';
    
    -- Calcular total vendido
    SELECT COALESCE(SUM(ii.quantity), 0) INTO total_vendido
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE ii.product_id = product_uuid
    AND i.status IN ('paid', 'completed', 'pagada', 'completada');
    
    -- Stock correcto
    stock_correcto := total_entradas - total_vendido;
    
    -- Stock actual erróneo
    SELECT COALESCE(quantity, 0) INTO stock_actual
    FROM inventory_stock
    WHERE product_id = product_uuid AND branch_id = branch_uuid;
    
    RAISE NOTICE '📊 CORRECCIÓN DE STOCK:';
    RAISE NOTICE '  Comprado: % unidades', total_entradas;
    RAISE NOTICE '  Vendido: % unidades', total_vendido;
    RAISE NOTICE '  Stock correcto: % unidades', stock_correcto;
    RAISE NOTICE '  Stock actual erróneo: % unidades', stock_actual;
    
    -- Actualizar directamente el stock
    UPDATE inventory_stock 
    SET 
        quantity = stock_correcto,
        last_movement_date = NOW(),
        updated_at = NOW()
    WHERE product_id = product_uuid AND branch_id = branch_uuid;
    
    RAISE NOTICE '✅ Stock corregido de % a % unidades', stock_actual, stock_correcto;
    
END $$;

-- 4. Verificar resultado
SELECT 
    'STOCK CORREGIDO:' as info,
    p.name as producto,
    iss.quantity as stock_final_correcto
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';