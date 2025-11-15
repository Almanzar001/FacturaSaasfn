-- Configuración inicial para organizaciones existentes
-- Esta migración crea automáticamente la sucursal principal para todas las organizaciones existentes
-- y configura el inventario como deshabilitado por defecto

-- Crear sucursal principal para cada organización existente
INSERT INTO branches (organization_id, name, code, is_main, is_active)
SELECT 
    id,
    name || ' - Principal',
    'PRINCIPAL',
    TRUE,
    TRUE
FROM organizations
WHERE id NOT IN (SELECT DISTINCT organization_id FROM branches WHERE is_main = TRUE);

-- Crear configuración de inventario deshabilitada por defecto para todas las organizaciones
INSERT INTO inventory_settings (organization_id, inventory_enabled, low_stock_threshold, auto_deduct_on_invoice, require_stock_validation)
SELECT 
    id,
    FALSE, -- Inventario deshabilitado por defecto
    10,    -- Threshold bajo de stock por defecto
    TRUE,  -- Auto-deducir en facturas
    TRUE   -- Requerir validación de stock
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM inventory_settings);

-- Función para crear automáticamente sucursal principal y configuración de inventario para nuevas organizaciones
CREATE OR REPLACE FUNCTION setup_new_organization()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear sucursal principal automáticamente
    INSERT INTO branches (organization_id, name, code, is_main, is_active)
    VALUES (NEW.id, NEW.name || ' - Principal', 'PRINCIPAL', TRUE, TRUE);
    
    -- Crear configuración de inventario deshabilitada por defecto
    INSERT INTO inventory_settings (organization_id, inventory_enabled)
    VALUES (NEW.id, FALSE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para configurar automáticamente nuevas organizaciones
CREATE TRIGGER setup_new_organization_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION setup_new_organization();

-- Función para obtener estadísticas de inventario por organización
CREATE OR REPLACE FUNCTION get_inventory_stats(org_id UUID)
RETURNS TABLE (
    total_products INTEGER,
    tracked_products INTEGER,
    low_stock_items INTEGER,
    total_branches INTEGER,
    inventory_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id),
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id AND is_inventory_tracked = TRUE),
        (SELECT COUNT(*)::INTEGER 
         FROM inventory_stock s 
         JOIN branches b ON s.branch_id = b.id 
         WHERE b.organization_id = org_id AND s.quantity <= s.min_stock),
        (SELECT COUNT(*)::INTEGER FROM branches WHERE organization_id = org_id AND is_active = TRUE),
        (SELECT COALESCE(inventory_enabled, FALSE) FROM inventory_settings WHERE organization_id = org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener productos con bajo stock
CREATE OR REPLACE FUNCTION get_low_stock_products(org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    branch_id UUID,
    branch_name VARCHAR(255),
    current_stock INTEGER,
    min_stock INTEGER,
    sku VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        b.id,
        b.name,
        s.quantity,
        s.min_stock,
        p.sku
    FROM inventory_stock s
    JOIN products p ON s.product_id = p.id
    JOIN branches b ON s.branch_id = b.id
    WHERE b.organization_id = org_id 
    AND s.quantity <= s.min_stock
    AND p.is_inventory_tracked = TRUE
    ORDER BY (s.quantity - s.min_stock), p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar movimiento de inventario
CREATE OR REPLACE FUNCTION register_inventory_movement(
    p_product_id UUID,
    p_branch_id UUID,
    p_movement_type VARCHAR(50),
    p_quantity INTEGER,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_cost_price DECIMAL(10,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    movement_id UUID;
    current_stock INTEGER := 0;
    new_stock INTEGER;
BEGIN
    -- Obtener stock actual
    SELECT COALESCE(quantity, 0) INTO current_stock
    FROM inventory_stock
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    -- Calcular nuevo stock
    new_stock := current_stock + p_quantity;
    
    -- Validar que el stock no sea negativo
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, Cantidad requerida: %', current_stock, ABS(p_quantity);
    END IF;
    
    -- Insertar el movimiento
    INSERT INTO inventory_movements (
        product_id, 
        branch_id, 
        movement_type, 
        quantity, 
        previous_quantity, 
        new_quantity,
        reference_type, 
        reference_id, 
        cost_price,
        notes, 
        user_id
    ) VALUES (
        p_product_id,
        p_branch_id,
        p_movement_type,
        p_quantity,
        current_stock,
        new_stock,
        p_reference_type,
        p_reference_id,
        p_cost_price,
        p_notes,
        auth.uid()
    ) RETURNING id INTO movement_id;
    
    RETURN movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para procesar transferencia entre sucursales
CREATE OR REPLACE FUNCTION process_inventory_transfer(transfer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    transfer_record inventory_transfers%ROWTYPE;
    item_record inventory_transfer_items%ROWTYPE;
BEGIN
    -- Obtener información de la transferencia
    SELECT * INTO transfer_record FROM inventory_transfers WHERE id = transfer_id;
    
    IF transfer_record.status != 'pendiente' THEN
        RAISE EXCEPTION 'La transferencia debe estar en estado pendiente para ser procesada';
    END IF;
    
    -- Procesar cada item de la transferencia
    FOR item_record IN 
        SELECT * FROM inventory_transfer_items WHERE transfer_id = transfer_id
    LOOP
        -- Salida de la sucursal origen
        PERFORM register_inventory_movement(
            item_record.product_id,
            transfer_record.from_branch_id,
            'transferencia_salida',
            -item_record.quantity,
            'transferencia',
            transfer_id,
            item_record.cost_price,
            'Transferencia a ' || (SELECT name FROM branches WHERE id = transfer_record.to_branch_id)
        );
        
        -- Entrada a la sucursal destino
        PERFORM register_inventory_movement(
            item_record.product_id,
            transfer_record.to_branch_id,
            'transferencia_entrada',
            item_record.quantity,
            'transferencia',
            transfer_id,
            item_record.cost_price,
            'Transferencia de ' || (SELECT name FROM branches WHERE id = transfer_record.from_branch_id)
        );
    END LOOP;
    
    -- Actualizar estado de la transferencia
    UPDATE inventory_transfers 
    SET 
        status = 'completado',
        completed_by = auth.uid(),
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = transfer_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON FUNCTION setup_new_organization() IS 'Configura automáticamente sucursal principal e inventario para nuevas organizaciones';
COMMENT ON FUNCTION get_inventory_stats(UUID) IS 'Obtiene estadísticas de inventario para una organización';
COMMENT ON FUNCTION get_low_stock_products(UUID) IS 'Obtiene productos con stock bajo para una organización';
COMMENT ON FUNCTION register_inventory_movement IS 'Registra un movimiento de inventario y actualiza el stock';
COMMENT ON FUNCTION process_inventory_transfer(UUID) IS 'Procesa una transferencia entre sucursales';