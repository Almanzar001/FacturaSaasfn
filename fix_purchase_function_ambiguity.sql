-- CORREGIR AMBIGUEDAD EN FUNCIÓN DE COMPRAS
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar función problemática
DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB, TEXT) CASCADE;

-- 2. Crear función con nombres de variables sin ambiguedad
CREATE OR REPLACE FUNCTION register_purchase(
    org_id UUID,
    branch_id UUID,
    products_json JSONB,
    notes_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    product_item JSONB;
    product_uuid UUID;
    product_qty INTEGER;
    product_cost DECIMAL;
    movements_count INTEGER := 0;
    main_branch_id UUID;
    is_inventory_enabled BOOLEAN := FALSE; -- Cambié el nombre aquí
    current_stock INTEGER := 0;
    new_stock INTEGER := 0;
BEGIN
    -- Log inicial
    RAISE NOTICE 'Iniciando register_purchase con org=%, branch=%, products=%', 
        org_id, branch_id, products_json;
    
    -- Verificar inventario habilitado - usando alias para evitar ambigüedad
    SELECT COALESCE(s.inventory_enabled, FALSE) INTO is_inventory_enabled
    FROM inventory_settings s
    WHERE s.organization_id = org_id;
    
    RAISE NOTICE 'Inventario habilitado: %', is_inventory_enabled;
    
    IF NOT is_inventory_enabled THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'El inventario no está habilitado para esta organización'
        );
        RAISE NOTICE 'Retornando: inventario no habilitado';
        RETURN result;
    END IF;
    
    -- Obtener sucursal (usar la proporcionada o la principal)
    main_branch_id := branch_id;
    IF main_branch_id IS NULL THEN
        SELECT b.id INTO main_branch_id
        FROM branches b
        WHERE b.organization_id = org_id 
        AND b.is_main = TRUE 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Usando sucursal: %', main_branch_id;
    
    IF main_branch_id IS NULL THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'No se encontró sucursal válida'
        );
        RAISE NOTICE 'Retornando: sin sucursal';
        RETURN result;
    END IF;
    
    -- Procesar cada producto
    FOR product_item IN SELECT jsonb_array_elements(products_json)
    LOOP
        BEGIN
            -- Extraer datos del producto
            product_uuid := (product_item->>'product_id')::UUID;
            product_qty := (product_item->>'quantity')::INTEGER;
            product_cost := COALESCE((product_item->>'cost_price')::DECIMAL, 0);
            
            RAISE NOTICE 'Procesando producto: id=%, qty=%, cost=%', 
                product_uuid, product_qty, product_cost;
            
            -- Verificar que el producto existe y tiene inventario
            IF EXISTS (
                SELECT 1 FROM products p
                WHERE p.id = product_uuid 
                AND p.organization_id = org_id 
                AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
            ) AND product_qty > 0 THEN
                
                -- Obtener stock actual
                SELECT COALESCE(st.quantity, 0) INTO current_stock
                FROM inventory_stock st
                WHERE st.product_id = product_uuid AND st.branch_id = main_branch_id;
                
                new_stock := current_stock + product_qty;
                
                -- Insertar movimiento
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
                    user_id,
                    movement_date
                ) VALUES (
                    product_uuid,
                    main_branch_id,
                    'entrada',
                    product_qty,
                    current_stock,
                    new_stock,
                    'compra',
                    NULL,
                    product_cost,
                    COALESCE(notes_text, 'Compra registrada'),
                    auth.uid(),
                    NOW()
                );
                
                -- Actualizar o insertar en inventory_stock
                INSERT INTO inventory_stock (product_id, branch_id, quantity, cost_price, last_movement_date)
                VALUES (
                    product_uuid, 
                    main_branch_id, 
                    new_stock, 
                    product_cost, 
                    NOW()
                )
                ON CONFLICT (product_id, branch_id) 
                DO UPDATE SET 
                    quantity = new_stock,
                    cost_price = EXCLUDED.cost_price,
                    last_movement_date = EXCLUDED.last_movement_date,
                    updated_at = NOW();
                
                movements_count := movements_count + 1;
                RAISE NOTICE 'Movimiento registrado para producto % (stock: % -> %)', product_uuid, current_stock, new_stock;
                
            ELSE
                RAISE NOTICE 'Producto % no válido o sin inventario', product_uuid;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error con producto %: %', product_uuid, SQLERRM;
            -- Continuar con siguiente producto
        END;
    END LOOP;
    
    -- Preparar resultado
    IF movements_count > 0 THEN
        result := jsonb_build_object(
            'success', true,
            'message', 'Compra registrada exitosamente',
            'movements_created', movements_count
        );
    ELSE
        result := jsonb_build_object(
            'success', false,
            'message', 'No se pudieron registrar movimientos. Verifica que los productos tengan inventario habilitado.',
            'movements_created', 0
        );
    END IF;
    
    RAISE NOTICE 'Retornando resultado: %', result;
    RETURN result;
END;
$$;

-- 3. Otorgar permisos
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon, authenticated, service_role;

-- 4. Asegurar configuración de inventario
INSERT INTO inventory_settings (organization_id, inventory_enabled, low_stock_threshold)
SELECT DISTINCT p.organization_id, TRUE, 10
FROM products p
WHERE COALESCE(p.is_inventory_tracked, FALSE) = TRUE
AND p.organization_id NOT IN (SELECT organization_id FROM inventory_settings)
ON CONFLICT (organization_id) DO UPDATE SET inventory_enabled = TRUE;

-- 5. Prueba simple
DO $$
DECLARE
    test_result JSONB;
BEGIN
    RAISE NOTICE '=== FUNCIÓN CREADA EXITOSAMENTE ===';
    
    -- Verificar que existe
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_purchase') THEN
        RAISE NOTICE '✅ Función register_purchase existe';
    ELSE
        RAISE NOTICE '❌ Función register_purchase NO existe';
    END IF;
    
    -- Mostrar organizaciones con inventario habilitado
    FOR test_result IN 
        SELECT jsonb_build_object(
            'organization', o.name,
            'inventory_enabled', COALESCE(s.inventory_enabled, FALSE),
            'products_tracked', (
                SELECT COUNT(*) FROM products p 
                WHERE p.organization_id = o.id 
                AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
            )
        ) as info
        FROM organizations o
        LEFT JOIN inventory_settings s ON o.id = s.organization_id
    LOOP
        RAISE NOTICE 'Org: %', test_result;
    END LOOP;
END $$;

COMMENT ON FUNCTION register_purchase IS 'Función corregida para registro de compras sin ambiguedades';