-- CORREGIR FUNCIÓN register_inventory_movement
-- El problema es que no actualiza la tabla inventory_stock

-- Eliminar función actual
DROP FUNCTION IF EXISTS register_inventory_movement CASCADE;

-- Crear función corregida que SÍ actualice el stock
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
        user_id,
        movement_date
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
        auth.uid(),
        NOW()
    ) RETURNING id INTO movement_id;
    
    -- *** ESTA ES LA PARTE QUE FALTABA ***
    -- Actualizar o insertar en inventory_stock
    INSERT INTO inventory_stock (
        product_id, 
        branch_id, 
        quantity, 
        cost_price, 
        last_movement_date,
        created_at,
        updated_at
    ) VALUES (
        p_product_id,
        p_branch_id,
        new_stock,
        CASE WHEN p_cost_price > 0 THEN p_cost_price ELSE COALESCE((SELECT cost_price FROM inventory_stock WHERE product_id = p_product_id AND branch_id = p_branch_id), 0) END,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (product_id, branch_id) 
    DO UPDATE SET 
        quantity = new_stock,
        cost_price = CASE 
            WHEN EXCLUDED.cost_price > 0 THEN EXCLUDED.cost_price 
            ELSE inventory_stock.cost_price 
        END,
        last_movement_date = NOW(),
        updated_at = NOW();
    
    RETURN movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION register_inventory_movement TO authenticated, anon, service_role;

-- Comentario
COMMENT ON FUNCTION register_inventory_movement IS 'Registra un movimiento de inventario y ACTUALIZA el stock en inventory_stock';

-- Verificación
DO $$
BEGIN
    RAISE NOTICE '✅ Función register_inventory_movement corregida';
    RAISE NOTICE '   Ahora SÍ actualiza la tabla inventory_stock correctamente';
    RAISE NOTICE '   Esto debería solucionar el problema del stock incorrecto';
END $$;