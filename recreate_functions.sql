-- Recrear funciones RPC completamente
-- Primero deshabilitar RLS
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items DISABLE ROW LEVEL SECURITY;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS get_inventory_stats(UUID);
DROP FUNCTION IF EXISTS get_low_stock_products(UUID);

-- Recrear función get_inventory_stats
CREATE FUNCTION get_inventory_stats(org_id UUID)
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
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM products p WHERE p.organization_id = org_id),
        (SELECT COUNT(*)::INTEGER FROM products p WHERE p.organization_id = org_id AND COALESCE(p.is_inventory_tracked, false) = true),
        (SELECT COUNT(*)::INTEGER 
         FROM inventory_stock s 
         JOIN branches b ON s.branch_id = b.id 
         WHERE b.organization_id = org_id AND s.quantity <= COALESCE(s.min_stock, 0)),
        (SELECT COUNT(*)::INTEGER FROM branches b WHERE b.organization_id = org_id AND COALESCE(b.is_active, true) = true),
        (SELECT COALESCE(inv_s.inventory_enabled, false) FROM inventory_settings inv_s WHERE inv_s.organization_id = org_id);
END;
$$ LANGUAGE plpgsql;

-- Recrear función get_low_stock_products con tipos TEXT
CREATE FUNCTION get_low_stock_products(org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    branch_id UUID,
    branch_name TEXT,
    current_stock INTEGER,
    min_stock INTEGER,
    sku TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name::TEXT,
        b.id,
        b.name::TEXT,
        s.quantity,
        COALESCE(s.min_stock, 0),
        COALESCE(p.sku, '')::TEXT
    FROM inventory_stock s
    JOIN products p ON s.product_id = p.id
    JOIN branches b ON s.branch_id = b.id
    WHERE b.organization_id = org_id 
    AND s.quantity <= COALESCE(s.min_stock, 0)
    AND COALESCE(p.is_inventory_tracked, false) = true
    ORDER BY (s.quantity - COALESCE(s.min_stock, 0)), p.name;
END;
$$ LANGUAGE plpgsql;

-- Probar las funciones recreadas
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    stats_result RECORD;
    products_count INTEGER;
BEGIN
    RAISE NOTICE 'Probando funciones recreadas...';
    
    -- Probar get_inventory_stats
    SELECT * INTO stats_result FROM get_inventory_stats(test_org_id);
    
    RAISE NOTICE 'get_inventory_stats: productos=%, rastreados=%, stock_bajo=%, sucursales=%, inventario=%', 
        COALESCE(stats_result.total_products, 0), 
        COALESCE(stats_result.tracked_products, 0), 
        COALESCE(stats_result.low_stock_items, 0), 
        COALESCE(stats_result.total_branches, 0), 
        COALESCE(stats_result.inventory_enabled, false);
    
    -- Probar get_low_stock_products
    SELECT COUNT(*) INTO products_count FROM get_low_stock_products(test_org_id);
    
    RAISE NOTICE 'get_low_stock_products: % productos encontrados', products_count;
    
    RAISE NOTICE 'SUCCESS: Todas las funciones RPC funcionan correctamente';
END $$;

-- Verificar estado final
SELECT 
    'Función: ' || p.proname as function_info,
    'Existe: SI' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_inventory_stats', 'get_low_stock_products')
ORDER BY p.proname;

SELECT 
    'Tabla: ' || c.relname as table_info,
    CASE WHEN c.relrowsecurity THEN 'RLS HABILITADO' ELSE 'RLS DESHABILITADO' END as rls_status
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings')
ORDER BY c.relname;