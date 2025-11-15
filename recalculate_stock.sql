-- RECALCULAR STOCK CORRECTO BASADO EN MOVIMIENTOS
-- Este script corrige el stock actual basándose en todos los movimientos registrados

-- 1. Función para recalcular stock de todos los productos
CREATE OR REPLACE FUNCTION recalculate_all_stock()
RETURNS TABLE (
    product_name VARCHAR(255),
    branch_name VARCHAR(255),
    old_stock INTEGER,
    calculated_stock INTEGER,
    difference INTEGER
) AS $$
DECLARE
    stock_record RECORD;
    calculated_qty INTEGER;
    old_qty INTEGER;
BEGIN
    -- Obtener todas las combinaciones únicas de producto/sucursal que tienen movimientos
    FOR stock_record IN 
        SELECT DISTINCT
            im.product_id,
            im.branch_id,
            p.name::VARCHAR(255) as product_name,
            b.name::VARCHAR(255) as branch_name
        FROM inventory_movements im
        JOIN products p ON im.product_id = p.id
        JOIN branches b ON im.branch_id = b.id
    LOOP
        -- Obtener stock actual registrado
        SELECT COALESCE(quantity, 0) INTO old_qty
        FROM inventory_stock
        WHERE product_id = stock_record.product_id 
        AND branch_id = stock_record.branch_id;
        
        -- Calcular stock correcto basado en movimientos
        SELECT COALESCE(SUM(quantity), 0) INTO calculated_qty
        FROM inventory_movements
        WHERE product_id = stock_record.product_id 
        AND branch_id = stock_record.branch_id;
        
        -- Solo actualizar si hay diferencia
        IF calculated_qty != old_qty THEN
            -- Actualizar o insertar stock correcto
            INSERT INTO inventory_stock (
                product_id, 
                branch_id, 
                quantity, 
                cost_price,
                last_movement_date,
                created_at,
                updated_at
            )
            SELECT 
                stock_record.product_id,
                stock_record.branch_id,
                calculated_qty,
                COALESCE(MAX(im.cost_price), 0),
                MAX(im.movement_date),
                NOW(),
                NOW()
            FROM inventory_movements im
            WHERE im.product_id = stock_record.product_id 
            AND im.branch_id = stock_record.branch_id
            AND im.cost_price > 0
            ON CONFLICT (product_id, branch_id) 
            DO UPDATE SET 
                quantity = EXCLUDED.quantity,
                last_movement_date = EXCLUDED.last_movement_date,
                updated_at = NOW();
        END IF;
        
        -- Devolver resultado para verificación
        RETURN QUERY SELECT 
            stock_record.product_name::VARCHAR(255),
            stock_record.branch_name::VARCHAR(255),
            old_qty,
            calculated_qty,
            (calculated_qty - old_qty);
            
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 2. Ejecutar recálculo
SELECT 
    '=== RECÁLCULO DE STOCK ===' as info,
    product_name,
    branch_name,
    old_stock,
    calculated_stock,
    difference,
    CASE 
        WHEN difference = 0 THEN '✅ Correcto'
        WHEN difference > 0 THEN '⬆️ Stock aumentado'
        WHEN difference < 0 THEN '⬇️ Stock corregido'
    END as status
FROM recalculate_all_stock()
ORDER BY product_name, branch_name;

-- 3. Mostrar resumen después del recálculo
SELECT 
    '=== RESUMEN FINAL ===' as info,
    p.name as producto,
    b.name as sucursal,
    iss.quantity as stock_final,
    (SELECT COUNT(*) FROM inventory_movements WHERE product_id = p.id AND branch_id = b.id) as total_movimientos
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
JOIN branches b ON iss.branch_id = b.id
ORDER BY p.name;

-- 4. Limpiar función temporal
DROP FUNCTION recalculate_all_stock();

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '🔧 STOCK RECALCULADO';
    RAISE NOTICE '   Revisa los resultados arriba para verificar los cambios';
    RAISE NOTICE '   El stock ahora debería coincidir con los movimientos registrados';
END $$;