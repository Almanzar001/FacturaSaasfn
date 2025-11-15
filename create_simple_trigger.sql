-- CREAR TRIGGER SIMPLE QUE FUNCIONE

-- 1. Eliminar triggers existentes que no funcionan
DROP TRIGGER IF EXISTS process_inventory_after_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS process_inventory_on_paid_invoice_insert ON invoices;
DROP TRIGGER IF EXISTS validate_stock_before_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS validate_stock_on_paid_invoice_insert ON invoices;
DROP TRIGGER IF EXISTS revert_inventory_on_invoice_cancellation ON invoices;

-- 2. Crear función simple y confiable
CREATE OR REPLACE FUNCTION simple_process_invoice_inventory()
RETURNS TRIGGER AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
BEGIN
    RAISE NOTICE '🔥 TRIGGER EJECUTADO: Factura %, Status: %', NEW.invoice_number, NEW.status;
    
    -- Solo procesar facturas pagadas
    IF NEW.status NOT IN ('paid', 'completed', 'pagada', 'completada') THEN
        RAISE NOTICE '⏭️  Status no es pagada, saltando';
        RETURN NEW;
    END IF;
    
    -- Verificar si inventario está habilitado
    SELECT inventory_enabled INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = NEW.organization_id;
    
    IF NOT COALESCE(inventory_enabled_flag, FALSE) THEN
        RAISE NOTICE '⏭️  Inventario no habilitado, saltando';
        RETURN NEW;
    END IF;
    
    -- Determinar sucursal
    branch_id_to_use := NEW.branch_id;
    IF branch_id_to_use IS NULL THEN
        SELECT id INTO branch_id_to_use
        FROM branches 
        WHERE organization_id = NEW.organization_id 
        AND is_main = TRUE 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE '🏢 Usando sucursal: %', branch_id_to_use;
    
    -- Procesar items con inventario
    FOR item_record IN 
        SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name, p.is_inventory_tracked
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = NEW.id
        AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
    LOOP
        RAISE NOTICE '📦 Procesando: % (cantidad: %)', item_record.product_name, item_record.quantity;
        
        -- Verificar que no haya movimiento duplicado
        IF NOT EXISTS (
            SELECT 1 FROM inventory_movements im 
            WHERE im.reference_type = 'factura' 
            AND im.reference_id = NEW.id
            AND im.product_id = item_record.product_id
        ) THEN
            
            BEGIN
                SELECT register_inventory_movement(
                    item_record.product_id,
                    branch_id_to_use,
                    'salida',
                    -item_record.quantity,  -- Negativo para salida
                    'factura',
                    NEW.id,
                    item_record.unit_price,
                    'Venta automática - Factura #' || NEW.invoice_number
                ) INTO movement_id;
                
                RAISE NOTICE '✅ Movimiento creado: %', movement_id;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ Error procesando %: %', item_record.product_name, SQLERRM;
            END;
        ELSE
            RAISE NOTICE '⏭️  Producto % ya procesado', item_record.product_name;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear triggers simples
CREATE TRIGGER simple_process_inventory_insert
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION simple_process_invoice_inventory();

CREATE TRIGGER simple_process_inventory_update
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION simple_process_invoice_inventory();

-- 4. Verificar instalación
SELECT 
    '✅ TRIGGERS SIMPLES INSTALADOS:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%simple%'
ORDER BY trigger_name;

-- 5. Mensaje
DO $$
BEGIN
    RAISE NOTICE '🎯 TRIGGERS SIMPLES INSTALADOS';
    RAISE NOTICE '   Se ejecutarán en TODAS las operaciones INSERT/UPDATE de facturas';
    RAISE NOTICE '   Con logging detallado para diagnosticar problemas';
    RAISE NOTICE '   Haz una venta de prueba y revisa los logs';
END $$;