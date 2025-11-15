-- Corregir políticas RLS para inventory_settings
-- El problema es que la política actual no permite INSERT cuando no existe el registro

-- Eliminar todas las políticas existentes para inventory_settings
DROP POLICY IF EXISTS "Users can view inventory settings from their organization" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can manage inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can insert inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can update inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners can delete inventory settings" ON inventory_settings;

-- Crear políticas más específicas y permisivas para inventory_settings
CREATE POLICY "Users can view inventory settings from their organization" ON inventory_settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners and admins can insert inventory settings" ON inventory_settings
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

CREATE POLICY "Owners and admins can update inventory settings" ON inventory_settings
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

CREATE POLICY "Owners can delete inventory settings" ON inventory_settings
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'propietario'
        )
    );

-- Función helper para upsert de configuración de inventario (más segura)
CREATE OR REPLACE FUNCTION upsert_inventory_settings(
    p_organization_id UUID,
    p_inventory_enabled BOOLEAN DEFAULT NULL,
    p_low_stock_threshold INTEGER DEFAULT NULL,
    p_auto_deduct_on_invoice BOOLEAN DEFAULT NULL,
    p_require_stock_validation BOOLEAN DEFAULT NULL
)
RETURNS inventory_settings AS $$
DECLARE
    result inventory_settings;
    current_user_role TEXT;
BEGIN
    -- Verificar permisos del usuario
    SELECT role INTO current_user_role
    FROM profiles 
    WHERE id = auth.uid() 
    AND organization_id = p_organization_id;

    IF current_user_role NOT IN ('propietario', 'administrador') THEN
        RAISE EXCEPTION 'No tienes permisos para modificar la configuración de inventario';
    END IF;

    -- Intentar actualizar primero
    UPDATE inventory_settings 
    SET 
        inventory_enabled = COALESCE(p_inventory_enabled, inventory_enabled),
        low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold),
        auto_deduct_on_invoice = COALESCE(p_auto_deduct_on_invoice, auto_deduct_on_invoice),
        require_stock_validation = COALESCE(p_require_stock_validation, require_stock_validation),
        updated_at = NOW()
    WHERE organization_id = p_organization_id
    RETURNING * INTO result;

    -- Si no existe, crear uno nuevo
    IF NOT FOUND THEN
        INSERT INTO inventory_settings (
            organization_id,
            inventory_enabled,
            low_stock_threshold,
            auto_deduct_on_invoice,
            require_stock_validation
        ) VALUES (
            p_organization_id,
            COALESCE(p_inventory_enabled, FALSE),
            COALESCE(p_low_stock_threshold, 10),
            COALESCE(p_auto_deduct_on_invoice, TRUE),
            COALESCE(p_require_stock_validation, TRUE)
        )
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corregir también las políticas de inventory_stock para permitir upsert
DROP POLICY IF EXISTS "Users can view inventory stock from their organization" ON inventory_stock;
DROP POLICY IF EXISTS "Users can manage inventory stock from their organization" ON inventory_stock;
DROP POLICY IF EXISTS "Users can insert inventory stock from their organization" ON inventory_stock;
DROP POLICY IF EXISTS "Users can update inventory stock from their organization" ON inventory_stock;
DROP POLICY IF EXISTS "Owners and admins can delete inventory stock" ON inventory_stock;

CREATE POLICY "Users can view inventory stock from their organization" ON inventory_stock
    FOR SELECT USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can insert inventory stock from their organization" ON inventory_stock
    FOR INSERT WITH CHECK (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador', 'vendedor')
        )
    );

CREATE POLICY "Users can update inventory stock from their organization" ON inventory_stock
    FOR UPDATE USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador', 'vendedor')
        )
    );

CREATE POLICY "Owners and admins can delete inventory stock" ON inventory_stock
    FOR DELETE USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador')
        )
    );

-- Función helper para actualizar stock de forma segura
CREATE OR REPLACE FUNCTION upsert_inventory_stock_level(
    p_stock_id UUID,
    p_field_name TEXT,
    p_value NUMERIC
)
RETURNS inventory_stock AS $$
DECLARE
    result inventory_stock;
    user_org_id UUID;
    stock_org_id UUID;
    user_role TEXT;
BEGIN
    -- Obtener información del usuario
    SELECT organization_id, role INTO user_org_id, user_role
    FROM profiles 
    WHERE id = auth.uid();

    -- Obtener organización del stock
    SELECT b.organization_id INTO stock_org_id
    FROM inventory_stock s
    JOIN branches b ON s.branch_id = b.id
    WHERE s.id = p_stock_id;

    -- Verificar permisos
    IF user_org_id != stock_org_id OR user_role NOT IN ('propietario', 'administrador', 'vendedor') THEN
        RAISE EXCEPTION 'No tienes permisos para actualizar este stock';
    END IF;

    -- Validar campo
    IF p_field_name NOT IN ('min_stock', 'max_stock', 'cost_price') THEN
        RAISE EXCEPTION 'Campo no válido: %', p_field_name;
    END IF;

    -- Actualizar según el campo
    IF p_field_name = 'min_stock' THEN
        UPDATE inventory_stock 
        SET min_stock = p_value::INTEGER, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    ELSIF p_field_name = 'max_stock' THEN
        UPDATE inventory_stock 
        SET max_stock = CASE WHEN p_value = 0 THEN NULL ELSE p_value::INTEGER END, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    ELSIF p_field_name = 'cost_price' THEN
        UPDATE inventory_stock 
        SET cost_price = p_value, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON FUNCTION upsert_inventory_settings IS 'Función segura para crear o actualizar configuración de inventario';
COMMENT ON FUNCTION upsert_inventory_stock_level IS 'Función segura para actualizar niveles de stock';