-- Agregar función register_purchase que falta
-- Esta función permite registrar compras y entradas manuales

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
    
    IF branch_id_to_use IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No se encontró sucursal válida', 0;
        RETURN;
    END IF;
    
    -- Procesar cada producto
    FOR product_record IN 
        SELECT 
            (item->>'product_id')::UUID as product_id,
            (item->>'quantity')::INTEGER as quantity,
            (item->>'cost_price')::DECIMAL as cost_price
        FROM jsonb_array_elements(p_products) as item
    LOOP
        -- Validar que el producto existe y tiene inventario habilitado
        IF NOT EXISTS (
            SELECT 1 FROM products 
            WHERE id = product_record.product_id 
            AND organization_id = p_organization_id 
            AND COALESCE(is_inventory_tracked, FALSE) = TRUE
        ) THEN
            CONTINUE; -- Saltar productos que no tienen inventario habilitado
        END IF;
        
        -- Registrar entrada de inventario
        BEGIN
            SELECT register_inventory_movement(
                product_record.product_id,
                branch_id_to_use,
                'entrada',
                product_record.quantity,
                'compra',
                NULL,
                COALESCE(product_record.cost_price, 0),
                COALESCE(p_notes, 'Compra registrada manualmente')
            ) INTO movement_id;
            
            movements_count := movements_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Continuar con el siguiente producto si hay error
            CONTINUE;
        END;
    END LOOP;
    
    IF movements_count > 0 THEN
        RETURN QUERY SELECT TRUE, 'Compra registrada exitosamente', movements_count;
    ELSE
        RETURN QUERY SELECT FALSE, 'No se registraron movimientos. Verifica que los productos tengan inventario habilitado.', 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Verificar que la función se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'register_purchase'
    ) THEN
        RAISE NOTICE 'SUCCESS: Función register_purchase creada correctamente';
    ELSE
        RAISE EXCEPTION 'ERROR: No se pudo crear la función register_purchase';
    END IF;
END $$;

COMMENT ON FUNCTION register_purchase IS 'Registra compras y entradas manuales de productos al inventario';