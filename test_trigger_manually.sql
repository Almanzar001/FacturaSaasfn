-- PROBAR TRIGGER MANUALMENTE PARA NUEVA VENTA

-- Obtener la factura más reciente que no se procesó
WITH latest_sale AS (
    SELECT 
        i.id,
        i.invoice_number,
        i.status,
        i.organization_id,
        i.branch_id
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    ORDER BY i.created_at DESC
    LIMIT 1
)
-- Mostrar información de la factura
SELECT 
    'FACTURA A PROCESAR:' as info,
    invoice_number,
    status,
    organization_id,
    branch_id
FROM latest_sale;

-- Procesar manualmente los items de la factura más reciente
DO $$
DECLARE
    invoice_rec RECORD;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
    inventory_enabled_flag BOOLEAN := FALSE;
BEGIN
    -- Obtener la factura más reciente
    SELECT i.* INTO invoice_rec
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    RAISE NOTICE 'Procesando factura: %', invoice_rec.invoice_number;
    
    -- Verificar si inventario está habilitado
    SELECT inventory_enabled INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = invoice_rec.organization_id;
    
    RAISE NOTICE 'Inventario habilitado: %', inventory_enabled_flag;
    
    IF NOT COALESCE(inventory_enabled_flag, FALSE) THEN
        RAISE NOTICE 'PROBLEMA: Inventario NO está habilitado';
        RETURN;
    END IF;
    
    -- Determinar sucursal
    branch_id_to_use := invoice_rec.branch_id;
    
    IF branch_id_to_use IS NULL THEN
        SELECT id INTO branch_id_to_use
        FROM branches 
        WHERE organization_id = invoice_rec.organization_id 
        AND is_main = TRUE 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Usando sucursal: %', branch_id_to_use;
    
    -- Procesar items de la factura
    FOR item_record IN 
        SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name, p.is_inventory_tracked
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = invoice_rec.id
        AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
    LOOP
        RAISE NOTICE 'Procesando producto: % (cantidad: %)', item_record.product_name, item_record.quantity;
        
        -- Registrar movimiento de salida (venta)
        BEGIN
            SELECT register_inventory_movement(
                item_record.product_id,
                branch_id_to_use,
                'salida',
                -item_record.quantity,  -- Cantidad negativa para salida
                'factura',
                invoice_rec.id,
                item_record.unit_price,
                'Venta manual - Factura #' || invoice_rec.invoice_number
            ) INTO movement_id;
            
            RAISE NOTICE '✅ Movimiento creado con ID: %', movement_id;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Error procesando inventario para producto %: %', item_record.product_name, SQLERRM;
        END;
    END LOOP;
    
END $$;

-- Verificar resultado
SELECT 
    'STOCK DESPUÉS DEL PROCESAMIENTO:' as info,
    p.name as producto,
    iss.quantity as stock_actual
FROM inventory_stock iss
JOIN products p ON iss.product_id = p.id
WHERE p.name = 'Liquido Naranja 50ml';