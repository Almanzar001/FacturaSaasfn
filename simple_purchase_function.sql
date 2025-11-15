-- Crear función simplificada para registro de compras
-- Esta versión es más simple y debería funcionar sin problemas

-- 1. Eliminar función existente
DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB, TEXT);

-- 2. Crear versión simplificada
CREATE OR REPLACE FUNCTION register_purchase(
    p_organization_id UUID,
    p_branch_id UUID,
    p_products JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inventory_enabled_flag BOOLEAN := FALSE;
    movements_count INTEGER := 0;
    branch_id_to_use UUID;
    product_item JSONB;
    product_id_val UUID;
    quantity_val INTEGER;
    cost_price_val DECIMAL;
    movement_id UUID;
    result JSONB;
BEGIN
    -- Verificar si inventario está habilitado
    SELECT COALESCE(inventory_enabled, FALSE) INTO inventory_enabled_flag
    FROM inventory_settings 
    WHERE organization_id = p_organization_id;
    
    IF NOT inventory_enabled_flag THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Inventario no está habilitado para esta organización',
            'movements_created', 0
        );
    END IF;
    
    -- Determinar sucursal
    branch_id_to_use := COALESCE(p_branch_id, (
        SELECT id FROM branches 
        WHERE organization_id = p_organization_id 
        AND is_main = TRUE 
        LIMIT 1
    ));
    
    IF branch_id_to_use IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No se encontró sucursal válida',
            'movements_created', 0
        );
    END IF;
    
    -- Procesar productos uno por uno
    IF jsonb_typeof(p_products) = 'array' THEN
        FOR product_item IN SELECT jsonb_array_elements(p_products)
        LOOP
            BEGIN
                -- Extraer valores
                product_id_val := (product_item->>'product_id')::UUID;
                quantity_val := (product_item->>'quantity')::INTEGER;
                cost_price_val := COALESCE((product_item->>'cost_price')::DECIMAL, 0);
                
                -- Validar que el producto tiene inventario habilitado
                IF EXISTS (
                    SELECT 1 FROM products 
                    WHERE id = product_id_val 
                    AND organization_id = p_organization_id 
                    AND COALESCE(is_inventory_tracked, FALSE) = TRUE
                ) AND quantity_val > 0 THEN
                    
                    -- Registrar movimiento
                    SELECT register_inventory_movement(
                        product_id_val,
                        branch_id_to_use,
                        'entrada',
                        quantity_val,
                        'compra',
                        NULL,
                        cost_price_val,
                        COALESCE(p_notes, 'Compra registrada')
                    ) INTO movement_id;
                    
                    IF movement_id IS NOT NULL THEN
                        movements_count := movements_count + 1;
                    END IF;
                END IF;
                
            EXCEPTION WHEN OTHERS THEN
                -- Continuar con el siguiente producto si hay error
                CONTINUE;
            END;
        END LOOP;
    END IF;
    
    -- Retornar resultado
    IF movements_count > 0 THEN
        result := jsonb_build_object(
            'success', true,
            'message', 'Compra registrada exitosamente',
            'movements_created', movements_count
        );
    ELSE
        result := jsonb_build_object(
            'success', false,
            'message', 'No se registraron movimientos. Verifica que los productos tengan inventario habilitado.',
            'movements_created', 0
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Otorgar permisos
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon, authenticated, service_role;

-- 4. Probar la función
DO $$
DECLARE
    test_result JSONB;
    test_org_id UUID;
    test_branch_id UUID;
    test_products JSONB;
BEGIN
    -- Obtener datos de prueba
    SELECT id INTO test_org_id FROM organizations WHERE EXISTS (
        SELECT 1 FROM inventory_settings 
        WHERE organization_id = organizations.id 
        AND inventory_enabled = TRUE
    ) LIMIT 1;
    
    IF test_org_id IS NOT NULL THEN
        SELECT id INTO test_branch_id FROM branches WHERE organization_id = test_org_id LIMIT 1;
        
        test_products := '[{"product_id": "' || (
            SELECT id FROM products 
            WHERE organization_id = test_org_id 
            AND COALESCE(is_inventory_tracked, FALSE) = TRUE
            LIMIT 1
        ) || '", "quantity": 5, "cost_price": 10.00}]';
        
        SELECT register_purchase(test_org_id, test_branch_id, test_products, 'Test') INTO test_result;
        
        RAISE NOTICE 'Test result: %', test_result;
    ELSE
        RAISE NOTICE 'No hay organizaciones con inventario habilitado para probar';
    END IF;
END $$;

COMMENT ON FUNCTION register_purchase IS 'Función simplificada para registrar compras de inventario';