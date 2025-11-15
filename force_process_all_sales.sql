-- FORZAR PROCESAMIENTO DE TODAS LAS VENTAS

-- Calcular cuánto se ha vendido realmente
WITH sales_summary AS (
    SELECT 
        SUM(ii.quantity) as total_vendido
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    AND i.status IN ('paid', 'completed', 'pagada', 'completada')
),
movements_summary AS (
    SELECT 
        SUM(CASE WHEN im.reference_type = 'factura' AND im.movement_type = 'salida' 
             THEN ABS(im.quantity) ELSE 0 END) as total_procesado
    FROM inventory_movements im
    JOIN products p ON im.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
)
SELECT 
    'RESUMEN:' as info,
    s.total_vendido as total_vendido_facturas,
    m.total_procesado as total_ya_procesado,
    (s.total_vendido - m.total_procesado) as faltante_por_procesar
FROM sales_summary s, movements_summary m;

-- Procesar manualmente cada factura no procesada
DO $$
DECLARE
    factura_record RECORD;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
    total_processed INTEGER := 0;
BEGIN
    RAISE NOTICE '🚀 Iniciando procesamiento manual de todas las ventas...';
    
    -- Procesar cada factura pagada individualmente
    FOR factura_record IN 
        SELECT i.id, i.invoice_number, i.organization_id, i.branch_id, i.created_at
        FROM invoices i
        JOIN invoice_items ii ON i.id = ii.invoice_id
        JOIN products p ON ii.product_id = p.id
        WHERE p.name = 'Liquido Naranja 50ml'
        AND i.status IN ('paid', 'completed', 'pagada', 'completada')
        ORDER BY i.created_at
    LOOP
        -- Verificar si ya está procesada
        IF NOT EXISTS (
            SELECT 1 FROM inventory_movements im 
            WHERE im.reference_type = 'factura' 
            AND im.reference_id = factura_record.id
        ) THEN
            RAISE NOTICE '📝 Procesando factura: % (fecha: %)', 
                factura_record.invoice_number, factura_record.created_at;
            
            -- Determinar sucursal
            branch_id_to_use := factura_record.branch_id;
            IF branch_id_to_use IS NULL THEN
                SELECT id INTO branch_id_to_use
                FROM branches 
                WHERE organization_id = factura_record.organization_id 
                AND is_main = TRUE 
                LIMIT 1;
            END IF;
            
            -- Procesar items
            FOR item_record IN 
                SELECT ii.product_id, ii.quantity, ii.unit_price
                FROM invoice_items ii
                JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = factura_record.id
                AND p.name = 'Liquido Naranja 50ml'
            LOOP
                BEGIN
                    SELECT register_inventory_movement(
                        item_record.product_id,
                        branch_id_to_use,
                        'salida',
                        -item_record.quantity,
                        'factura',
                        factura_record.id,
                        item_record.unit_price,
                        'Procesamiento manual masivo - ' || factura_record.invoice_number
                    ) INTO movement_id;
                    
                    RAISE NOTICE '  ✅ Procesada: % unidades, movimiento ID: %', 
                        item_record.quantity, movement_id;
                    total_processed := total_processed + item_record.quantity;
                    
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE '  ❌ Error en factura %: %', 
                        factura_record.invoice_number, SQLERRM;
                END;
            END LOOP;
        ELSE
            RAISE NOTICE '⏭️  Factura % ya estaba procesada', factura_record.invoice_number;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🎯 Total unidades procesadas: %', total_processed;
END $$;

-- Ver resultado final
SELECT 
    'RESULTADO FINAL:' as info,
    p.name as producto,
    iss.quantity as stock_actual,
    (SELECT COUNT(*) FROM inventory_movements im2 
     WHERE im2.product_id = p.id AND im2.reference_type = 'factura') as movimientos_de_venta
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';