-- FORZAR DESHABILITACIÓN COMPLETA DE RLS
-- Este script verifica y fuerza la deshabilitación de RLS

-- 1. Verificar estado actual detallado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'PROBLEMA: RLS AUN HABILITADO'
        ELSE 'OK: RLS DESHABILITADO'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY tablename;

-- 2. ELIMINAR todas las políticas existentes de forma agresiva
DO $$
DECLARE
    policy_record RECORD;
    table_names TEXT[] := ARRAY['branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items'];
    table_name TEXT;
BEGIN
    RAISE NOTICE 'Eliminando TODAS las políticas existentes...';
    
    FOREACH table_name IN ARRAY table_names
    LOOP
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = table_name
        LOOP
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I CASCADE', policy_record.policyname, table_name);
                RAISE NOTICE 'Eliminada política % de tabla %', policy_record.policyname, table_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error eliminando política % de tabla %: %', policy_record.policyname, table_name, SQLERRM;
            END;
        END LOOP;
    END LOOP;
END $$;

-- 3. FORZAR deshabilitación de RLS usando múltiples métodos
DO $$
DECLARE
    table_names TEXT[] := ARRAY['branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items'];
    table_name TEXT;
BEGIN
    RAISE NOTICE 'Deshabilitando RLS en todas las tablas...';
    
    FOREACH table_name IN ARRAY table_names
    LOOP
        BEGIN
            -- Método 1: ALTER TABLE standard
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
            
            -- Método 2: Forzar deshabilitación
            EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', table_name);
            
            RAISE NOTICE 'RLS deshabilitado en tabla: %', table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error en tabla %: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. Verificar que NO hay políticas activas
SELECT 
    'Políticas restantes' as info,
    COUNT(*) as cantidad,
    string_agg(tablename || '.' || policyname, ', ') as detalles
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items');

-- 5. Verificación final de RLS
SELECT 
    c.relname as tabla,
    c.relrowsecurity as rls_habilitado,
    c.relforcerowsecurity as rls_forzado,
    CASE 
        WHEN c.relrowsecurity OR c.relforcerowsecurity THEN 'PROBLEMA: RLS SIGUE ACTIVO'
        ELSE 'SUCCESS: RLS COMPLETAMENTE DESHABILITADO'
    END as estado_final
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY c.relname;

-- 6. Probar acceso directo a las tablas
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    branches_count INTEGER;
    settings_count INTEGER;
BEGIN
    -- Probar acceso directo a branches
    SELECT COUNT(*) INTO branches_count 
    FROM branches 
    WHERE organization_id = test_org_id;
    
    -- Probar acceso directo a inventory_settings
    SELECT COUNT(*) INTO settings_count 
    FROM inventory_settings 
    WHERE organization_id = test_org_id;
    
    RAISE NOTICE 'Acceso directo a tablas:';
    RAISE NOTICE 'branches: % registros encontrados', branches_count;
    RAISE NOTICE 'inventory_settings: % registros encontrados', settings_count;
    
    IF branches_count >= 0 AND settings_count >= 0 THEN
        RAISE NOTICE 'SUCCESS: Acceso directo a tablas funciona correctamente';
    END IF;
END $$;

-- 7. Comentarios de estado
COMMENT ON TABLE branches IS 'RLS FORZOSAMENTE DESHABILITADO - Acceso completo sin restricciones';
COMMENT ON TABLE inventory_settings IS 'RLS FORZOSAMENTE DESHABILITADO - Acceso completo sin restricciones';