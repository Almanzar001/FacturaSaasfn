-- Verificar estado de todas las políticas RLS
-- Ejecutar este script para ver qué políticas existen

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY tablename, policyname;

-- Verificar estado de RLS en cada tabla
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY c.relname;

-- Verificar funciones RPC
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_inventory_stats', 'get_low_stock_products', 'upsert_inventory_settings', 'upsert_inventory_stock_level')
ORDER BY p.proname;

-- Contar registros en tablas principales
SELECT 'organizations' as tabla, COUNT(*) as registros FROM organizations
UNION ALL
SELECT 'branches' as tabla, COUNT(*) as registros FROM branches
UNION ALL
SELECT 'inventory_settings' as tabla, COUNT(*) as registros FROM inventory_settings
UNION ALL
SELECT 'profiles' as tabla, COUNT(*) as registros FROM profiles;