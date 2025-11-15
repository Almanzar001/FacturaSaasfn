-- PROCESAR MANUALMENTE TODAS LAS VENTAS QUE NO SE REGISTRARON

-- Procesar todas las facturas pagadas que no tienen movimiento de inventario
DO $$
DECLARE
    factura_record RECORD;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
    processed_count INTEGER := 0;
BEGIN
    -- Buscar todas las facturas pagadas sin movimiento de inventario
    FOR factura_record IN 
        SELECT DISTINCT i.*
        FROM invoices i
        JOIN invoice_items ii ON i.id = ii.invoice_id
        JOIN products p ON ii.product_id = p.id
        WHERE p.name = 'Liquido Naranja 50ml'
        AND i.status IN ('paid', 'completed', 'pagada', 'completada')
        AND NOT EXISTS (
            SELECT 1 FROM inventory_movements im 
            WHERE im.reference_type = 'factura' 
            AND im.reference_id = i.id
        )
        ORDER BY i.created_at
    LOOP
        RAISE NOTICE 'Procesando factura: %', factura_record.invoice_number;
        
        -- Determinar sucursal
        branch_id_to_use := factura_record.branch_id;
        IF branch_id_to_use IS NULL THEN
            SELECT id INTO branch_id_to_use
            FROM branches 
            WHERE organization_id = factura_record.organization_id 
            AND is_main = TRUE 
            LIMIT 1;
        END IF;
        
        -- Procesar items de la factura
        FOR item_record IN 
            SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = factura_record.id
            AND p.name = 'Liquido Naranja 50ml'
        LOOP
            RAISE NOTICE '  Producto: %, Cantidad: %', item_record.product_name, item_record.quantity;
            
            -- Registrar movimiento de salida
            BEGIN
                SELECT register_inventory_movement(
                    item_record.product_id,
                    branch_id_to_use,
                    'salida',
                    -item_record.quantity,  -- Cantidad negativa para salida
                    'factura',
                    factura_record.id,
                    item_record.unit_price,
                    'Venta procesada manualmente - Factura #' || factura_record.invoice_number
                ) INTO movement_id;
                
                RAISE NOTICE '  ✅ Movimiento creado: %', movement_id;
                processed_count := processed_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '  ❌ Error: %', SQLERRM;
            END;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '🎯 Total de movimientos procesados: %', processed_count;
    
END $$;

-- Ver el stock final
SELECT 
    'STOCK FINAL:' as info,
    p.name as producto,
    iss.quantity as stock_actual
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';