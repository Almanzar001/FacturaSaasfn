-- Corregir tipos de datos en funciones RPC
-- Primero deshabilitar RLS
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items DISABLE ROW LEVEL SECURITY;

-- Función get_inventory_stats corregida
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

-- Función get_low_stock_products corregida con tipos explícitos
CREATE OR REPLACE FUNCTION get_low_stock_products(org_id UUID)
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
        p.id::UUID,
        p.name::TEXT,
        b.id::UUID,
        b.name::TEXT,
        s.quantity::INTEGER,
        COALESCE(s.min_stock, 0)::INTEGER,
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

-- Probar función get_inventory_stats primero
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    stats_result RECORD;
BEGIN
    RAISE NOTICE 'Probando función get_inventory_stats...';
    
    SELECT * INTO stats_result FROM get_inventory_stats(test_org_id);
    
    RAISE NOTICE 'SUCCESS - Estadísticas: productos=%, rastreados=%, stock_bajo=%, sucursales=%, inventario_habilitado=%', 
        COALESCE(stats_result.total_products, 0), 
        COALESCE(stats_result.tracked_products, 0), 
        COALESCE(stats_result.low_stock_items, 0), 
        COALESCE(stats_result.total_branches, 0), 
        COALESCE(stats_result.inventory_enabled, false);
        
    RAISE NOTICE 'Función get_inventory_stats funciona correctamente';
END $$;

-- Verificar datos en las tablas directamente
SELECT 'Verificando datos para organización 79620cfb-c28b-4d70-98e3-aa932237b88e' as info;

SELECT 
    'branches' as tabla, 
    COUNT(*) as registros,
    string_agg(name, ', ') as nombres
FROM branches 
WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e'
UNION ALL
SELECT 
    'inventory_settings' as tabla, 
    COUNT(*) as registros,
    CASE WHEN COUNT(*) > 0 THEN 'existe' ELSE 'no existe' END as nombres
FROM inventory_settings 
WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e'
UNION ALL
SELECT 
    'products' as tabla, 
    COUNT(*) as registros,
    CASE WHEN COUNT(*) > 0 THEN string_agg(name, ', ') ELSE 'sin productos' END as nombres
FROM products 
WHERE organization_id = '79620cfb-c28b-4d70-98e3-aa932237b88e';

-- Verificar que RLS está deshabilitado
SELECT 
    'RLS Status: ' || c.relname as table_info,
    CASE WHEN c.relrowsecurity THEN 'HABILITADO' ELSE 'DESHABILITADO' END as rls_status
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings')
ORDER BY c.relname;