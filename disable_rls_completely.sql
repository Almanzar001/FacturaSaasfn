-- DESHABILITAR RLS COMPLETAMENTE PARA DEBUGGING
-- Este script deshabilita RLS en todas las tablas problemáticas

DO $$
BEGIN
    RAISE NOTICE 'Deshabilitando RLS en todas las tablas de inventario...';
    
    -- Deshabilitar RLS
    ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_stock DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_transfers DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_transfer_items DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS deshabilitado completamente';
END $$;

-- Verificar que RLS está deshabilitado
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY c.relname;

-- Probar las funciones RPC directamente
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    stats_result RECORD;
BEGIN
    RAISE NOTICE 'Probando función get_inventory_stats...';
    
    SELECT * INTO stats_result FROM get_inventory_stats(test_org_id);
    
    RAISE NOTICE 'Resultado: total_products=%, tracked_products=%, low_stock_items=%, total_branches=%, inventory_enabled=%', 
        stats_result.total_products, 
        stats_result.tracked_products, 
        stats_result.low_stock_items, 
        stats_result.total_branches, 
        stats_result.inventory_enabled;
END $$;

-- Verificar datos directamente en las tablas
SELECT 'branches' as tabla, COUNT(*) as registros FROM branches WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e'
UNION ALL
SELECT 'inventory_settings' as tabla, COUNT(*) as registros FROM inventory_settings WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e'
UNION ALL
SELECT 'products' as tabla, COUNT(*) as registros FROM products WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e';

COMMENT ON TABLE branches IS 'RLS DESHABILITADO - Solo para debugging';
COMMENT ON TABLE inventory_settings IS 'RLS DESHABILITADO - Solo para debugging';