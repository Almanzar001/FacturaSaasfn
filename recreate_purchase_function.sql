-- Recrear función register_purchase con permisos correctos
-- Ejecutar después del script de diagnóstico

-- 1. Eliminar función existente si existe
DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB, TEXT);

-- 2. Recrear la función
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
    product_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Iniciando register_purchase con org=%, branch=%, products=%', 
        p_organization_id, p_branch_id, p_products;
    
    -- Verificar si inventario está habilitado
    SELECT COALESCE(inventory_enabled, FALSE) INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = p_organization_id;
    
    RAISE NOTICE 'Inventario habilitado: %', inventory_enabled_flag;
    
    IF NOT inventory_enabled_flag THEN
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
    
    RAISE NOTICE 'Usando sucursal: %', branch_id_to_use;
    
    -- Verificar que p_products es un array válido
    IF p_products IS NULL OR jsonb_array_length(p_products) = 0 THEN
        RETURN QUERY SELECT FALSE, 'No se proporcionaron productos válidos', 0;
        RETURN;
    END IF;
    
    -- Procesar cada producto
    FOR product_record IN 
        SELECT 
            (item->>'product_id')::UUID as product_id,
            (item->>'quantity')::INTEGER as quantity,
            COALESCE((item->>'cost_price')::DECIMAL, 0) as cost_price
        FROM jsonb_array_elements(p_products) as item
    LOOP
        RAISE NOTICE 'Procesando producto: id=%, qty=%, cost=%', 
            product_record.product_id, product_record.quantity, product_record.cost_price;
        
        -- Validar que el producto existe y tiene inventario habilitado
        SELECT EXISTS (
            SELECT 1 FROM products 
            WHERE id = product_record.product_id 
            AND organization_id = p_organization_id 
            AND COALESCE(is_inventory_tracked, FALSE) = TRUE
        ) INTO product_exists;
        
        IF NOT product_exists THEN
            RAISE NOTICE 'Producto % no existe o no tiene inventario habilitado', product_record.product_id;
            CONTINUE; -- Saltar productos que no tienen inventario habilitado
        END IF;
        
        -- Validar cantidad
        IF product_record.quantity <= 0 THEN
            RAISE NOTICE 'Cantidad inválida para producto %', product_record.product_id;
            CONTINUE;
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
                product_record.cost_price,
                COALESCE(p_notes, 'Compra registrada manualmente')
            ) INTO movement_id;
            
            movements_count := movements_count + 1;
            RAISE NOTICE 'Movimiento creado: %', movement_id;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error registrando movimiento para producto %: %', product_record.product_id, SQLERRM;
            -- Continuar con el siguiente producto
        END;
    END LOOP;
    
    IF movements_count > 0 THEN
        RETURN QUERY SELECT TRUE, 'Compra registrada exitosamente', movements_count;
    ELSE
        RETURN QUERY SELECT FALSE, 'No se registraron movimientos. Verifica que los productos tengan inventario habilitado.', 0;
    END IF;
    
    RAISE NOTICE 'Finalizando register_purchase con % movimientos', movements_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Otorgar permisos
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon, authenticated;

-- 4. Verificar que se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'register_purchase'
    ) THEN
        RAISE NOTICE 'SUCCESS: Función register_purchase recreada correctamente';
    ELSE
        RAISE EXCEPTION 'ERROR: No se pudo crear la función register_purchase';
    END IF;
END $$;

COMMENT ON FUNCTION register_purchase IS 'Registra compras y entradas manuales de productos al inventario con logging detallado';