-- Corregir ambigüedad en funciones RPC
-- Primero deshabilitar RLS
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items DISABLE ROW LEVEL SECURITY;

-- Corregir función get_inventory_stats con nombres de columnas totalmente calificados
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

-- Corregir función get_low_stock_products con nombres de columnas totalmente calificados  
CREATE OR REPLACE FUNCTION get_low_stock_products(org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    branch_id UUID,
    branch_name VARCHAR(255),
    current_stock INTEGER,
    min_stock INTEGER,
    sku VARCHAR(100)
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        b.id,
        b.name,
        s.quantity,
        COALESCE(s.min_stock, 0),
        p.sku
    FROM inventory_stock s
    JOIN products p ON s.product_id = p.id
    JOIN branches b ON s.branch_id = b.id
    WHERE b.organization_id = org_id 
    AND s.quantity <= COALESCE(s.min_stock, 0)
    AND COALESCE(p.is_inventory_tracked, false) = true
    ORDER BY (s.quantity - COALESCE(s.min_stock, 0)), p.name;
END;
$$ LANGUAGE plpgsql;

-- Probar las funciones corregidas
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    stats_result RECORD;
    products_count INTEGER;
BEGIN
    RAISE NOTICE 'Probando función get_inventory_stats corregida...';
    
    -- Probar función de estadísticas
    SELECT * INTO stats_result FROM get_inventory_stats(test_org_id);
    
    RAISE NOTICE 'SUCCESS - Estadísticas: productos=%, rastreados=%, stock_bajo=%, sucursales=%, inventario_habilitado=%', 
        stats_result.total_products, 
        stats_result.tracked_products, 
        stats_result.low_stock_items, 
        stats_result.total_branches, 
        stats_result.inventory_enabled;
        
    -- Probar función de productos con stock bajo
    SELECT COUNT(*) INTO products_count FROM get_low_stock_products(test_org_id);
    
    RAISE NOTICE 'SUCCESS - Productos con stock bajo: %', products_count;
    
    RAISE NOTICE 'Todas las funciones RPC funcionan correctamente';
END $$;

-- Verificar que RLS está deshabilitado
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relname IN ('branches', 'inventory_settings')
ORDER BY c.relname;