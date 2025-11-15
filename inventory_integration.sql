-- INTEGRACIÓN DE INVENTARIO CON FACTURAS
-- Este script automatiza el inventario con las ventas y compras

-- 1. FUNCIÓN PARA PROCESAR MOVIMIENTOS DE INVENTARIO EN FACTURAS
CREATE OR REPLACE FUNCTION process_invoice_inventory()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
BEGIN
    -- Solo procesar para facturas pagadas/completadas
    IF NEW.status NOT IN ('paid', 'completed', 'pagada', 'completada') THEN
        RETURN NEW;
    END IF;
    
    -- Verificar si el inventario está habilitado para esta organización
    SELECT inventory_enabled INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = NEW.organization_id;
    
    -- Si no está habilitado, salir sin hacer nada
    IF NOT COALESCE(inventory_enabled_flag, FALSE) THEN
        RAISE NOTICE 'Inventario no habilitado para organización %', NEW.organization_id;
        RETURN NEW;
    END IF;
    
    -- Determinar la sucursal a usar (la de la factura o la principal)
    branch_id_to_use := NEW.branch_id;
    
    IF branch_id_to_use IS NULL THEN
        -- Usar sucursal principal si no se especifica
        SELECT id INTO branch_id_to_use
        FROM branches 
        WHERE organization_id = NEW.organization_id 
        AND is_main = TRUE 
        LIMIT 1;
    END IF;
    
    -- Si aún no hay sucursal, crear una
    IF branch_id_to_use IS NULL THEN
        INSERT INTO branches (organization_id, name, code, is_main, is_active)
        VALUES (NEW.organization_id, 'Sucursal Principal', 'PRINCIPAL', TRUE, TRUE)
        RETURNING id INTO branch_id_to_use;
    END IF;
    
    -- Procesar todos los items de la factura
    FOR item_record IN 
        SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name, p.is_inventory_tracked
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = NEW.id
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
                NEW.id,
                item_record.unit_price,
                'Venta automática - Factura #' || NEW.invoice_number
            ) INTO movement_id;
            
            RAISE NOTICE 'Movimiento de inventario creado: %', movement_id;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error pero continuar procesamiento
            RAISE NOTICE 'Error procesando inventario para producto %: %', item_record.product_name, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. FUNCIÓN PARA REVERTIR MOVIMIENTOS AL CANCELAR FACTURAS
CREATE OR REPLACE FUNCTION revert_invoice_inventory()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
BEGIN
    -- Solo procesar cuando se cancela una factura que estaba pagada
    IF OLD.status IN ('paid', 'completed', 'pagada', 'completada') 
       AND NEW.status IN ('cancelled', 'cancelada') THEN
       
        -- Verificar si el inventario está habilitado
        SELECT inventory_enabled INTO inventory_enabled_flag
        FROM inventory_settings 
        WHERE organization_id = NEW.organization_id;
        
        IF NOT COALESCE(inventory_enabled_flag, FALSE) THEN
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
        
        -- Revertir movimientos (devolver stock)
        FOR item_record IN 
            SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = NEW.id
            AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
        LOOP
            BEGIN
                SELECT register_inventory_movement(
                    item_record.product_id,
                    branch_id_to_use,
                    'entrada',
                    item_record.quantity,  -- Cantidad positiva para devolver stock
                    'ajuste',
                    NEW.id,
                    item_record.unit_price,
                    'Reversión automática - Factura #' || NEW.invoice_number || ' cancelada'
                ) INTO movement_id;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error revirtiendo inventario para producto %: %', item_record.product_name, SQLERRM;
            END;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. FUNCIÓN PARA VALIDAR STOCK ANTES DE CONFIRMAR VENTA
CREATE OR REPLACE FUNCTION validate_invoice_stock()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    require_validation BOOLEAN := FALSE;
    item_record RECORD;
    branch_id_to_use UUID;
    current_stock INTEGER;
    stock_error TEXT := '';
BEGIN
    -- Solo validar cuando se confirma una factura
    IF NEW.status NOT IN ('paid', 'completed', 'pagada', 'completada') THEN
        RETURN NEW;
    END IF;
    
    -- Si era una factura ya confirmada, no validar nuevamente
    IF OLD.status IN ('paid', 'completed', 'pagada', 'completada') THEN
        RETURN NEW;
    END IF;
    
    -- Verificar configuración de inventario
    SELECT inventory_enabled, require_stock_validation 
    INTO inventory_enabled_flag, require_validation
    FROM inventory_settings 
    WHERE organization_id = NEW.organization_id;
    
    -- Si no está habilitado o no requiere validación, continuar
    IF NOT COALESCE(inventory_enabled_flag, FALSE) OR NOT COALESCE(require_validation, FALSE) THEN
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
    
    -- Validar stock para cada producto
    FOR item_record IN 
        SELECT ii.product_id, ii.quantity, p.name as product_name
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = NEW.id
        AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
    LOOP
        -- Obtener stock actual
        SELECT COALESCE(quantity, 0) INTO current_stock
        FROM inventory_stock
        WHERE product_id = item_record.product_id 
        AND branch_id = branch_id_to_use;
        
        -- Verificar si hay suficiente stock
        IF current_stock < item_record.quantity THEN
            stock_error := stock_error || 
                'Stock insuficiente para ' || item_record.product_name || 
                ' (disponible: ' || current_stock || ', requerido: ' || item_record.quantity || '). ';
        END IF;
    END LOOP;
    
    -- Si hay errores de stock, cancelar la operación
    IF stock_error != '' THEN
        RAISE EXCEPTION 'No se puede confirmar la factura: %', stock_error;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. CREAR TRIGGERS PARA AUTOMATIZACIÓN

-- Trigger para validar stock antes de confirmar factura
DROP TRIGGER IF EXISTS validate_stock_before_invoice_confirmation ON invoices;
CREATE TRIGGER validate_stock_before_invoice_confirmation
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION validate_invoice_stock();

-- Trigger para procesar inventario después de confirmar factura
DROP TRIGGER IF EXISTS process_inventory_after_invoice_confirmation ON invoices;
CREATE TRIGGER process_inventory_after_invoice_confirmation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION process_invoice_inventory();

-- Trigger para revertir inventario al cancelar factura
DROP TRIGGER IF EXISTS revert_inventory_on_invoice_cancellation ON invoices;
CREATE TRIGGER revert_inventory_on_invoice_cancellation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION revert_invoice_inventory();

-- 5. FUNCIÓN PARA COMPRAS (ENTRADA MANUAL DE PRODUCTOS)
CREATE OR REPLACE FUNCTION register_purchase(
    p_organization_id UUID,
    p_branch_id UUID,
    p_products JSONB,  -- Array de {product_id, quantity, cost_price}
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    movements_created INTEGER
) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    product_record RECORD;
    movement_id UUID;
    movements_count INTEGER := 0;
    branch_id_to_use UUID;
BEGIN
    -- Verificar si inventario está habilitado
    SELECT inventory_enabled INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = p_organization_id;
    
    IF NOT COALESCE(inventory_enabled_flag, FALSE) THEN
        RETURN QUERY SELECT FALSE, 'Inventario no está habilitado para esta organización', 0;
        RETURN;
    END IF;
    
    -- Determinar sucursal
    branch_id_to_use := p_branch_id;
    
    IF branch_id_to_use IS NULL THEN
        SELECT id INTO branch_id_to_use
        FROM branches 
        WHERE organization_id = p_organization_id 
        AND is_main = TRUE 
        LIMIT 1;
    END IF;
    
    -- Procesar cada producto
    FOR product_record IN 
        SELECT 
            (item->>'product_id')::UUID as product_id,
            (item->>'quantity')::INTEGER as quantity,
            (item->>'cost_price')::DECIMAL as cost_price
        FROM jsonb_array_elements(p_products) as item
    LOOP
        -- Registrar entrada de inventario
        SELECT register_inventory_movement(
            product_record.product_id,
            branch_id_to_use,
            'entrada',
            product_record.quantity,
            'compra',
            NULL,
            product_record.cost_price,
            p_notes
        ) INTO movement_id;
        
        movements_count := movements_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Compra registrada exitosamente', movements_count;
END;
$$ LANGUAGE plpgsql;

-- 6. VERIFICACIÓN Y COMENTARIOS
DO $$
BEGIN
    RAISE NOTICE '=== INTEGRACIÓN DE INVENTARIO INSTALADA ===';
    RAISE NOTICE 'Triggers creados:';
    RAISE NOTICE '1. validate_stock_before_invoice_confirmation - Valida stock antes de confirmar venta';
    RAISE NOTICE '2. process_inventory_after_invoice_confirmation - Descuenta stock automáticamente';
    RAISE NOTICE '3. revert_inventory_on_invoice_cancellation - Revierte stock al cancelar';
    RAISE NOTICE '';
    RAISE NOTICE 'Funciones disponibles:';
    RAISE NOTICE '1. register_purchase() - Para registrar compras/entradas manuales';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANTE: Solo funciona si inventory_enabled = true en la organización';
END $$;

COMMENT ON FUNCTION process_invoice_inventory IS 'Procesa automáticamente el inventario cuando se confirma una factura';
COMMENT ON FUNCTION revert_invoice_inventory IS 'Revierte movimientos de inventario cuando se cancela una factura';
COMMENT ON FUNCTION validate_invoice_stock IS 'Valida que hay suficiente stock antes de confirmar una venta';
COMMENT ON FUNCTION register_purchase IS 'Registra compras y entradas manuales de productos al inventario';