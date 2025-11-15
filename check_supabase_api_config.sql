-- Verificar configuración de API de Supabase
-- Este script identifica problemas de configuración de API

-- 1. Verificar configuración de esquema público
SELECT 
    'Esquema público:' as info,
    nspname as schema_name,
    nspowner,
    has_schema_privilege('public', nspname, 'USAGE') as can_use_schema
FROM pg_namespace 
WHERE nspname = 'public';

-- 2. Verificar permisos en las tablas para el rol 'anon' y 'authenticated'
DO $$
DECLARE
    table_names TEXT[] := ARRAY['branches', 'inventory_settings'];
    table_name TEXT;
    anon_select BOOLEAN;
    auth_select BOOLEAN;
BEGIN
    RAISE NOTICE 'Verificando permisos de roles para tablas...';
    
    FOREACH table_name IN ARRAY table_names
    LOOP
        -- Verificar permisos para rol anon
        SELECT has_table_privilege('anon', table_name, 'SELECT') INTO anon_select;
        
        -- Verificar permisos para rol authenticated  
        SELECT has_table_privilege('authenticated', table_name, 'SELECT') INTO auth_select;
        
        RAISE NOTICE 'Tabla %: anon=%, authenticated=%', table_name, anon_select, auth_select;
    END LOOP;
END $$;

-- 3. Otorgar permisos explícitos a los roles de Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE branches TO anon, authenticated;
GRANT ALL ON TABLE inventory_settings TO anon, authenticated;
GRANT ALL ON TABLE inventory_stock TO anon, authenticated;
GRANT ALL ON TABLE inventory_movements TO anon, authenticated;
GRANT ALL ON TABLE inventory_transfers TO anon, authenticated;
GRANT ALL ON TABLE inventory_transfer_items TO anon, authenticated;

-- 4. Otorgar permisos en las funciones RPC
GRANT EXECUTE ON FUNCTION get_inventory_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_inventory_settings(UUID, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_inventory_stock_level(UUID, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION test_api_access() TO anon, authenticated;

-- 5. Verificar que los permisos se aplicaron
DO $$
DECLARE
    table_names TEXT[] := ARRAY['branches', 'inventory_settings'];
    table_name TEXT;
    anon_select BOOLEAN;
    auth_select BOOLEAN;
BEGIN
    RAISE NOTICE 'Verificando permisos después de GRANT...';
    
    FOREACH table_name IN ARRAY table_names
    LOOP
        SELECT has_table_privilege('anon', table_name, 'SELECT') INTO anon_select;
        SELECT has_table_privilege('authenticated', table_name, 'SELECT') INTO auth_select;
        
        RAISE NOTICE 'Tabla %: anon=%, authenticated=%', table_name, anon_select, auth_select;
        
        IF NOT anon_select OR NOT auth_select THEN
            RAISE NOTICE 'WARNING: Faltan permisos en tabla %', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Permisos de API configurados completamente';
END $$;

-- 6. Crear una vista pública para test
CREATE OR REPLACE VIEW public_inventory_test AS
SELECT 
    'branches' as tabla,
    COUNT(*) as registros
FROM branches
UNION ALL
SELECT 
    'inventory_settings' as tabla,
    COUNT(*) as registros  
FROM inventory_settings;

GRANT SELECT ON public_inventory_test TO anon, authenticated;

-- 7. Verificar la vista
SELECT * FROM public_inventory_test;

COMMENT ON VIEW public_inventory_test IS 'Vista de prueba para verificar acceso API a tablas de inventario';