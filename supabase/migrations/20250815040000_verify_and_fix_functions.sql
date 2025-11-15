-- Verificar y corregir funciones RPC para inventario
-- Esta migración asegura que todas las funciones existan y tengan permisos correctos

-- Verificar que las tablas existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches') THEN
        RAISE EXCEPTION 'Tabla branches no existe. Aplica primero la migración 20250815000000';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_settings') THEN
        RAISE EXCEPTION 'Tabla inventory_settings no existe. Aplica primero la migración 20250815010000';
    END IF;
END $$;

-- Recrear funciones con SECURITY DEFINER para asegurar permisos
CREATE OR REPLACE FUNCTION get_inventory_stats(org_id UUID)
RETURNS TABLE (
    total_products INTEGER,
    tracked_products INTEGER,
    low_stock_items INTEGER,
    total_branches INTEGER,
    inventory_enabled BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario pertenece a la organización
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND organization_id = org_id
    ) THEN
        RAISE EXCEPTION 'No tienes acceso a esta organización';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id),
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id AND is_inventory_tracked = TRUE),
        (SELECT COUNT(*)::INTEGER 
         FROM inventory_stock s 
         JOIN branches b ON s.branch_id = b.id 
         WHERE b.organization_id = org_id AND s.quantity <= COALESCE(s.min_stock, 0)),
        (SELECT COUNT(*)::INTEGER FROM branches WHERE organization_id = org_id AND is_active = TRUE),
        (SELECT COALESCE(inventory_enabled, FALSE) FROM inventory_settings WHERE organization_id = org_id);
END;
$$ LANGUAGE plpgsql;

-- Recrear función para productos con stock bajo
CREATE OR REPLACE FUNCTION get_low_stock_products(org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    branch_id UUID,
    branch_name VARCHAR(255),
    current_stock INTEGER,
    min_stock INTEGER,
    sku VARCHAR(100)
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar que el usuario pertenece a la organización
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND organization_id = org_id
    ) THEN
        RAISE EXCEPTION 'No tienes acceso a esta organización';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        b.id,
        b.name,
        s.quantity,
        COALESCE(s.min_stock, 0),
        p.sku
    FROM inventory_stock s
    JOIN products p ON s.product_id = p.id
    JOIN branches b ON s.branch_id = b.id
    WHERE b.organization_id = org_id 
    AND s.quantity <= COALESCE(s.min_stock, 0)
    AND p.is_inventory_tracked = TRUE
    ORDER BY (s.quantity - COALESCE(s.min_stock, 0)), p.name;
END;
$$ LANGUAGE plpgsql;

-- Asegurar que existe la función register_inventory_movement
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
RETURNS UUID 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    movement_id UUID;
    current_stock INTEGER := 0;
    new_stock INTEGER;
    user_org_id UUID;
    branch_org_id UUID;
BEGIN
    -- Verificar que el usuario pertenece a la organización
    SELECT organization_id INTO user_org_id
    FROM profiles 
    WHERE id = auth.uid();
    
    SELECT organization_id INTO branch_org_id
    FROM branches 
    WHERE id = p_branch_id;
    
    IF user_org_id != branch_org_id THEN
        RAISE EXCEPTION 'No tienes permisos para esta sucursal';
    END IF;

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
$$ LANGUAGE plpgsql;

-- Asegurar que las políticas correctas están activas para branches
DROP POLICY IF EXISTS "Temp allow all for debugging branches" ON branches;
DROP POLICY IF EXISTS "Users can view branches from their organization" ON branches;
DROP POLICY IF EXISTS "Owners and admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Owners and admins can update branches" ON branches;
DROP POLICY IF EXISTS "Owners can delete branches" ON branches;

CREATE POLICY "Users can view branches from their organization" ON branches
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners and admins can insert branches" ON branches
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

CREATE POLICY "Owners and admins can update branches" ON branches
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

CREATE POLICY "Owners can delete branches" ON branches
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'propietario'
        )
    );

-- Asegurar que las políticas correctas están activas para inventory_settings
DROP POLICY IF EXISTS "Temp allow all for debugging inventory_settings" ON inventory_settings;

-- Verificar que las funciones se crearon correctamente
DO $$
BEGIN
    -- Verificar get_inventory_stats
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_inventory_stats'
    ) THEN
        RAISE EXCEPTION 'Función get_inventory_stats no se creó';
    END IF;
    
    -- Verificar get_low_stock_products
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_low_stock_products'
    ) THEN
        RAISE EXCEPTION 'Función get_low_stock_products no se creó';
    END IF;
    
    RAISE NOTICE 'Todas las funciones se crearon correctamente';
END $$;

-- Comentarios
COMMENT ON FUNCTION get_inventory_stats IS 'Obtiene estadísticas de inventario para una organización con permisos verificados';
COMMENT ON FUNCTION get_low_stock_products IS 'Obtiene productos con stock bajo para una organización con permisos verificados';
COMMENT ON FUNCTION register_inventory_movement IS 'Registra movimientos de inventario con validaciones de seguridad';