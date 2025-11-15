-- SOLUCIÓN NUCLEAR - Si nada más funciona
-- Ejecuta esto en SQL Editor de Supabase

-- 1. Eliminar TODA función register_purchase existente
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS register_purchase CASCADE;
    DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS register_purchase(UUID, UUID, JSONB) CASCADE;
    RAISE NOTICE 'Funciones eliminadas';
END $$;

-- 2. Crear función con nombre diferente para evitar conflictos
CREATE OR REPLACE FUNCTION add_inventory_purchase(
    org_id UUID,
    branch_id UUID,
    products_json JSONB,
    notes_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_data JSONB;
    product_item JSONB;
    product_id_val UUID;
    quantity_val INTEGER;
    cost_val DECIMAL;
    movements INTEGER := 0;
    branch_to_use UUID;
BEGIN
    RAISE LOG 'add_inventory_purchase iniciando con org=%, branch=%, products=%', 
        org_id, branch_id, products_json;
    
    -- Determinar sucursal
    branch_to_use := COALESCE(branch_id, (
        SELECT id FROM branches WHERE organization_id = org_id AND is_main = TRUE LIMIT 1
    ));
    
    IF branch_to_use IS NULL THEN
        RETURN '{"success": false, "message": "Sin sucursal válida", "movements_created": 0}'::JSONB;
    END IF;
    
    -- Procesar productos
    FOR product_item IN SELECT jsonb_array_elements(products_json) LOOP
        BEGIN
            product_id_val := (product_item->>'product_id')::UUID;
            quantity_val := (product_item->>'quantity')::INTEGER;
            cost_val := COALESCE((product_item->>'cost_price')::DECIMAL, 0);
            
            -- Insertar movimiento
            INSERT INTO inventory_movements (
                product_id, branch_id, movement_type, quantity,
                previous_quantity, new_quantity, reference_type,
                cost_price, notes, movement_date
            ) VALUES (
                product_id_val, branch_to_use, 'entrada', quantity_val,
                0, quantity_val, 'compra',
                cost_val, COALESCE(notes_text, 'Compra manual'), NOW()
            );
            
            -- Actualizar stock
            INSERT INTO inventory_stock (product_id, branch_id, quantity, cost_price, last_movement_date, created_at, updated_at)
            VALUES (product_id_val, branch_to_use, quantity_val, cost_val, NOW(), NOW(), NOW())
            ON CONFLICT (product_id, branch_id) 
            DO UPDATE SET 
                quantity = inventory_stock.quantity + quantity_val,
                cost_price = cost_val,
                last_movement_date = NOW(),
                updated_at = NOW();
            
            movements := movements + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Error con producto %: %', product_id_val, SQLERRM;
        END;
    END LOOP;
    
    -- Resultado
    result_data := jsonb_build_object(
        'success', movements > 0,
        'message', CASE WHEN movements > 0 THEN 'Compra registrada' ELSE 'Sin movimientos' END,
        'movements_created', movements
    );
    
    RAISE LOG 'Resultado: %', result_data;
    RETURN result_data;
END;
$$;

-- 3. Permisos totales
GRANT ALL ON FUNCTION add_inventory_purchase(UUID, UUID, JSONB, TEXT) TO public, anon, authenticated, service_role;

-- 4. Crear alias con el nombre original
CREATE OR REPLACE FUNCTION register_purchase(
    p_organization_id UUID,
    p_branch_id UUID,
    p_products JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT add_inventory_purchase(p_organization_id, p_branch_id, p_products, p_notes);
$$;

-- 5. Permisos para el alias
GRANT ALL ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO public, anon, authenticated, service_role;

-- 6. Verificación
SELECT 'Verificación:' as test, COUNT(*) as functions_created 
FROM pg_proc 
WHERE proname IN ('register_purchase', 'add_inventory_purchase');

-- 7. Test directo
SELECT add_inventory_purchase(
    (SELECT id FROM organizations LIMIT 1),
    (SELECT id FROM branches LIMIT 1),
    '[{"product_id": "00000000-0000-0000-0000-000000000000", "quantity": 1, "cost_price": 10}]'::JSONB,
    'Test directo'
) as test_result;

RAISE NOTICE 'NUCLEAR FIX COMPLETADO - Probando ahora...';