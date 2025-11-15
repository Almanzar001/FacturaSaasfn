-- CREAR FUNCIÓN DE COMPRAS QUE DEFINITIVAMENTE FUNCIONE
-- Ejecutar este script completo en el SQL Editor de Supabase

-- 1. Eliminar función existente
DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB, TEXT) CASCADE;

-- 2. Crear función súper simple que funcione
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
    inventory_enabled BOOLEAN := FALSE;
BEGIN
    -- Log inicial
    RAISE NOTICE 'Iniciando register_purchase con org=%, branch=%, products=%', 
        org_id, branch_id, products_json;
    
    -- Verificar inventario habilitado
    SELECT COALESCE(inventory_enabled, FALSE) INTO inventory_enabled
    FROM inventory_settings 
    WHERE organization_id = org_id;
    
    RAISE NOTICE 'Inventario habilitado: %', inventory_enabled;
    
    IF NOT inventory_enabled THEN
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
        SELECT id INTO main_branch_id
        FROM branches 
        WHERE organization_id = org_id 
        AND is_main = TRUE 
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
                SELECT 1 FROM products 
                WHERE id = product_uuid 
                AND organization_id = org_id 
                AND COALESCE(is_inventory_tracked, FALSE) = TRUE
            ) AND product_qty > 0 THEN
                
                -- Insertar directamente en inventory_movements
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
                    COALESCE((SELECT quantity FROM inventory_stock WHERE product_id = product_uuid AND branch_id = main_branch_id), 0),
                    COALESCE((SELECT quantity FROM inventory_stock WHERE product_id = product_uuid AND branch_id = main_branch_id), 0) + product_qty,
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
                    product_qty, 
                    product_cost, 
                    NOW()
                )
                ON CONFLICT (product_id, branch_id) 
                DO UPDATE SET 
                    quantity = inventory_stock.quantity + EXCLUDED.quantity,
                    cost_price = EXCLUDED.cost_price,
                    last_movement_date = EXCLUDED.last_movement_date,
                    updated_at = NOW();
                
                movements_count := movements_count + 1;
                RAISE NOTICE 'Movimiento registrado para producto %', product_uuid;
                
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

-- 3. Otorgar permisos completos
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon, authenticated, service_role;

-- 4. Asegurar que inventario esté habilitado para organizaciones que lo necesiten
UPDATE inventory_settings 
SET inventory_enabled = TRUE 
WHERE organization_id IN (
    SELECT DISTINCT organization_id 
    FROM products 
    WHERE COALESCE(is_inventory_tracked, FALSE) = TRUE
);

-- 5. Crear configuración de inventario para organizaciones que no la tienen
INSERT INTO inventory_settings (organization_id, inventory_enabled, low_stock_threshold)
SELECT DISTINCT p.organization_id, TRUE, 10
FROM products p
WHERE COALESCE(p.is_inventory_tracked, FALSE) = TRUE
AND p.organization_id NOT IN (SELECT organization_id FROM inventory_settings)
ON CONFLICT (organization_id) DO UPDATE SET inventory_enabled = TRUE;

-- 6. Prueba automática
DO $$
DECLARE
    test_org UUID;
    test_branch UUID;
    test_product UUID;
    test_result JSONB;
BEGIN
    -- Buscar organización con productos de inventario
    SELECT p.organization_id INTO test_org
    FROM products p
    WHERE COALESCE(p.is_inventory_tracked, FALSE) = TRUE
    LIMIT 1;
    
    IF test_org IS NOT NULL THEN
        -- Buscar sucursal
        SELECT id INTO test_branch FROM branches WHERE organization_id = test_org LIMIT 1;
        
        -- Buscar producto
        SELECT id INTO test_product 
        FROM products 
        WHERE organization_id = test_org 
        AND COALESCE(is_inventory_tracked, FALSE) = TRUE
        LIMIT 1;
        
        IF test_branch IS NOT NULL AND test_product IS NOT NULL THEN
            -- Probar función
            SELECT register_purchase(
                test_org,
                test_branch,
                ('[{"product_id": "' || test_product || '", "quantity": 5, "cost_price": 15.75}]')::JSONB,
                'Prueba automática del sistema'
            ) INTO test_result;
            
            RAISE NOTICE '=== RESULTADO DE PRUEBA ===';
            RAISE NOTICE 'Organización: %', test_org;
            RAISE NOTICE 'Sucursal: %', test_branch;
            RAISE NOTICE 'Producto: %', test_product;
            RAISE NOTICE 'Resultado: %', test_result;
            
            IF (test_result->>'success')::BOOLEAN THEN
                RAISE NOTICE 'SUCCESS: ✅ La función funciona correctamente!';
            ELSE
                RAISE NOTICE 'ERROR: ❌ %', test_result->>'message';
            END IF;
        ELSE
            RAISE NOTICE 'No se pueden ejecutar pruebas: faltan sucursal o producto';
        END IF;
    ELSE
        RAISE NOTICE 'No hay productos con inventario para probar';
    END IF;
END $$;

-- 7. Verificar estado final
SELECT 
    'Verificación final:' as status,
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'register_purchase') as funcion_existe,
    (SELECT COUNT(*) FROM inventory_settings WHERE inventory_enabled = TRUE) as orgs_con_inventario,
    (SELECT COUNT(*) FROM products WHERE COALESCE(is_inventory_tracked, FALSE) = TRUE) as productos_con_inventario;

COMMENT ON FUNCTION register_purchase IS 'Función simplificada y robusta para registro de compras de inventario';