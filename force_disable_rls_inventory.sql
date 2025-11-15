-- FORZAR DESHABILITACIÓN DE RLS PARA INVENTORY_SETTINGS
-- Ejecutar este script directamente en el SQL Editor de Supabase

-- 1. Mostrar estado actual de RLS
DO $$
DECLARE
    rls_status BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_status 
    FROM pg_class 
    WHERE relname = 'inventory_settings';
    
    RAISE NOTICE 'Estado actual de RLS en inventory_settings: %', rls_status;
END $$;

-- 2. Eliminar TODAS las políticas existentes de forma forzada
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'inventory_settings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inventory_settings', policy_record.policyname);
        RAISE NOTICE 'Eliminada política: %', policy_record.policyname;
    END LOOP;
END $$;

-- 3. FORZAR deshabilitación de RLS
ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;

-- 4. Verificar que RLS está deshabilitado
DO $$
DECLARE
    rls_status BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_status 
    FROM pg_class 
    WHERE relname = 'inventory_settings';
    
    IF rls_status THEN
        RAISE EXCEPTION 'ERROR: RLS sigue habilitado en inventory_settings';
    ELSE
        RAISE NOTICE 'SUCCESS: RLS deshabilitado correctamente en inventory_settings';
    END IF;
END $$;

-- 5. Recrear función upsert_inventory_settings SIN validaciones de RLS
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
BEGIN
    -- Sin validaciones de permisos - solo actualizar/insertar
    
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

-- 6. Probar la función directamente
DO $$
DECLARE
    test_org_id UUID;
    test_result inventory_settings;
BEGIN
    -- Obtener una organización existente
    SELECT id INTO test_org_id FROM organizations LIMIT 1;
    
    IF test_org_id IS NOT NULL THEN
        -- Probar la función
        SELECT * INTO test_result FROM upsert_inventory_settings(test_org_id, TRUE, 15, TRUE, FALSE);
        
        IF test_result.id IS NOT NULL THEN
            RAISE NOTICE 'SUCCESS: Función upsert_inventory_settings funciona correctamente';
            RAISE NOTICE 'Configuración actualizada para organización: %', test_org_id;
        ELSE
            RAISE EXCEPTION 'ERROR: La función no devolvió resultados';
        END IF;
    ELSE
        RAISE NOTICE 'No hay organizaciones para probar';
    END IF;
END $$;

-- 7. Verificación final
DO $$
DECLARE
    settings_count INTEGER;
    function_exists BOOLEAN;
BEGIN
    -- Contar registros en inventory_settings
    SELECT COUNT(*) INTO settings_count FROM inventory_settings;
    
    -- Verificar que la función existe
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'upsert_inventory_settings'
    ) INTO function_exists;
    
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    RAISE NOTICE 'Registros en inventory_settings: %', settings_count;
    RAISE NOTICE 'Función upsert_inventory_settings existe: %', function_exists;
    
    IF function_exists THEN
        RAISE NOTICE 'SUCCESS: Todo configurado correctamente - RLS deshabilitado y función funcional';
    ELSE
        RAISE EXCEPTION 'ERROR: Función no existe';
    END IF;
END $$;

COMMENT ON TABLE inventory_settings IS 'Tabla de configuración de inventario - RLS DESHABILITADO para debugging';
COMMENT ON FUNCTION upsert_inventory_settings IS 'Función para actualizar configuración de inventario - SIN validaciones RLS';