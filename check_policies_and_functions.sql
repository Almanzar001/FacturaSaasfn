-- Verificar políticas RLS existentes
SELECT 
    tablename,
    policyname,
    cmd as operations
FROM pg_policies 
WHERE tablename IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY tablename, policyname;

-- Verificar funciones RPC
SELECT 
    p.proname as function_name,
    p.prosecdef as has_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_inventory_stats', 'get_low_stock_products', 'upsert_inventory_settings', 'upsert_inventory_stock_level')
ORDER BY p.proname;