-- Fix para permisos de inventory_settings
-- Ejecutar este script directamente en el SQL Editor de Supabase

-- 1. Eliminar políticas existentes que pueden estar causando conflicto
DROP POLICY IF EXISTS "Allow access to organization inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Allow all operations for organization users" ON inventory_settings;
DROP POLICY IF EXISTS "Users can view inventory settings from their organization" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can insert inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can update inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners can delete inventory settings" ON inventory_settings;

-- 2. Deshabilitar temporalmente RLS
ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;

-- 3. Recrear la función upsert_inventory_settings con permisos más amplios
CREATE OR REPLACE FUNCTION upsert_inventory_settings(
    p_organization_id UUID,
    p_inventory_enabled BOOLEAN DEFAULT NULL,
    p_low_stock_threshold INTEGER DEFAULT NULL,
    p_auto_deduct_on_invoice BOOLEAN DEFAULT NULL,
    p_require_stock_validation BOOLEAN DEFAULT NULL
)
RETURNS inventory_settings 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result inventory_settings;
    user_org_id UUID;
BEGIN
    -- Verificar que el usuario pertenezca a la organización
    SELECT organization_id INTO user_org_id
    FROM profiles 
    WHERE id = auth.uid();
    
    IF user_org_id != p_organization_id THEN
        RAISE EXCEPTION 'No tienes permisos para modificar esta organización';
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
$$ LANGUAGE plpgsql;

-- 4. Habilitar RLS nuevamente
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;

-- 5. Crear una política más simple y permisiva
CREATE POLICY "Allow organization users full access" ON inventory_settings
    FOR ALL USING (
        organization_id = (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- 6. Asegurar que todas las organizaciones tengan configuración
INSERT INTO inventory_settings (organization_id, inventory_enabled, low_stock_threshold, auto_deduct_on_invoice, require_stock_validation)
SELECT 
    id,
    FALSE,
    10,
    TRUE,
    TRUE
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM inventory_settings)
ON CONFLICT (organization_id) DO NOTHING;

-- 7. Verificar que la función existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'upsert_inventory_settings'
    ) THEN
        RAISE EXCEPTION 'La función upsert_inventory_settings no se creó correctamente';
    END IF;
    
    RAISE NOTICE 'Fix de permisos aplicado exitosamente';
END $$;

COMMENT ON FUNCTION upsert_inventory_settings IS 'Función segura para actualizar configuración de inventario con validación de permisos';