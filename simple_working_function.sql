-- FUNCIÓN SIMPLE QUE DEFINITIVAMENTE FUNCIONE
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Eliminar funciones existentes
DROP FUNCTION IF EXISTS register_purchase CASCADE;

-- 2. Crear función súper simple
CREATE OR REPLACE FUNCTION register_purchase(
    p_organization_id UUID,
    p_branch_id UUID,
    p_products JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    movements_count INTEGER := 0;
    product_item JSONB;
    product_id_val UUID;
    quantity_val INTEGER;
    cost_val DECIMAL;
    branch_to_use UUID;
BEGIN
    -- Usar sucursal proporcionada o buscar principal
    branch_to_use := p_branch_id;
    IF branch_to_use IS NULL THEN
        SELECT id INTO branch_to_use FROM branches 
        WHERE organization_id = p_organization_id AND is_main = TRUE LIMIT 1;
    END IF;
    
    -- Si no hay sucursal, error
    IF branch_to_use IS NULL THEN
        RETURN '{"success": false, "message": "No hay sucursal válida"}'::JSONB;
    END IF;
    
    -- Procesar cada producto
    FOR product_item IN SELECT jsonb_array_elements(p_products)
    LOOP
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
            cost_val, COALESCE(p_notes, 'Compra'), NOW()
        );
        
        -- Actualizar stock
        INSERT INTO inventory_stock (product_id, branch_id, quantity, cost_price, last_movement_date)
        VALUES (product_id_val, branch_to_use, quantity_val, cost_val, NOW())
        ON CONFLICT (product_id, branch_id) 
        DO UPDATE SET 
            quantity = inventory_stock.quantity + quantity_val,
            cost_price = cost_val,
            last_movement_date = NOW();
        
        movements_count := movements_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', movements_count > 0,
        'message', CASE WHEN movements_count > 0 THEN 'Éxito' ELSE 'Sin movimientos' END,
        'movements_created', movements_count
    );
END;
$$;

-- 3. Dar permisos
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION register_purchase(UUID, UUID, JSONB, TEXT) TO service_role;

-- 4. Verificar
SELECT 
    'Status:' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_purchase') 
        THEN 'Función creada ✅'
        ELSE 'Función NO creada ❌'
    END as resultado;