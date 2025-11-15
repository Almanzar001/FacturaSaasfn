-- FIX RÁPIDO - Crear función register_purchase que funcione
-- Ejecutar en SQL Editor de Supabase AHORA MISMO

-- 1. Crear función simple
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
    current_stock INTEGER := 0;
BEGIN
    RAISE NOTICE 'register_purchase llamada con org=%, branch=%', org_id, branch_id;
    
    -- Usar sucursal proporcionada o buscar principal
    main_branch_id := branch_id;
    IF main_branch_id IS NULL THEN
        SELECT id INTO main_branch_id FROM branches WHERE organization_id = org_id AND is_main = TRUE LIMIT 1;
    END IF;
    
    -- Si no hay sucursal, crear respuesta de error
    IF main_branch_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró sucursal', 'movements_created', 0);
    END IF;
    
    -- Procesar productos
    FOR product_item IN SELECT jsonb_array_elements(products_json)
    LOOP
        product_uuid := (product_item->>'product_id')::UUID;
        product_qty := (product_item->>'quantity')::INTEGER;
        product_cost := COALESCE((product_item->>'cost_price')::DECIMAL, 0);
        
        -- Insertar movimiento directamente
        BEGIN
            INSERT INTO inventory_movements (
                product_id, branch_id, movement_type, quantity, 
                previous_quantity, new_quantity, reference_type,
                cost_price, notes, user_id, movement_date
            ) VALUES (
                product_uuid, main_branch_id, 'entrada', product_qty,
                0, product_qty, 'compra',
                product_cost, COALESCE(notes_text, 'Compra'), auth.uid(), NOW()
            );
            
            -- Actualizar stock
            INSERT INTO inventory_stock (product_id, branch_id, quantity, cost_price, last_movement_date)
            VALUES (product_uuid, main_branch_id, product_qty, product_cost, NOW())
            ON CONFLICT (product_id, branch_id) 
            DO UPDATE SET 
                quantity = inventory_stock.quantity + EXCLUDED.quantity,
                cost_price = EXCLUDED.cost_price,
                last_movement_date = NOW();
            
            movements_count := movements_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error procesando producto %: %', product_uuid, SQLERRM;
        END;
    END LOOP;
    
    -- Retornar resultado
    IF movements_count > 0 THEN
        result := jsonb_build_object('success', true, 'message', 'Compra registrada', 'movements_created', movements_count);
    ELSE
        result := jsonb_build_object('success', false, 'message', 'No se registraron movimientos', 'movements_created', 0);
    END IF;
    
    RAISE NOTICE 'Retornando: %', result;
    RETURN result;
END;
$$;

-- 2. Otorgar permisos a TODOS los roles
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO public;
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO service_role;

-- 3. Verificar que existe
SELECT 
    'Función register_purchase:' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_purchase') 
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as resultado;

-- 4. Verificar permisos
SELECT 
    'Permisos:' as status,
    CASE 
        WHEN has_function_privilege('anon', 'register_purchase(uuid,uuid,jsonb,text)', 'EXECUTE')
        THEN '✅ PERMISOS OK'
        ELSE '❌ SIN PERMISOS'
    END as resultado;

RAISE NOTICE 'Script completado - función register_purchase creada y con permisos';