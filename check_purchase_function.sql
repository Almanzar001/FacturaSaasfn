-- Verificar si la función register_purchase existe y funciona
-- Ejecutar este script para diagnosticar el problema

-- 1. Verificar que la función existe
SELECT 
    'Función register_purchase:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname = 'register_purchase'
        ) THEN 'EXISTS'
        ELSE 'NOT FOUND'
    END as status;

-- 2. Ver la definición de la función si existe
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'register_purchase';

-- 3. Verificar permisos en la función
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'register_purchase'
    ) THEN
        RAISE NOTICE 'Función register_purchase existe';
        
        -- Verificar permisos
        IF has_function_privilege('anon', 'register_purchase(uuid, uuid, jsonb, text)', 'EXECUTE') THEN
            RAISE NOTICE 'Permisos anon: OK';
        ELSE
            RAISE NOTICE 'Permisos anon: DENIED';
        END IF;
        
        IF has_function_privilege('authenticated', 'register_purchase(uuid, uuid, jsonb, text)', 'EXECUTE') THEN
            RAISE NOTICE 'Permisos authenticated: OK';
        ELSE
            RAISE NOTICE 'Permisos authenticated: DENIED';
        END IF;
    ELSE
        RAISE NOTICE 'Función register_purchase NO EXISTE';
    END IF;
END $$;

-- 4. Probar la función con datos de ejemplo
DO $$
DECLARE
    test_org_id UUID;
    test_branch_id UUID;
    result RECORD;
    test_products JSONB;
BEGIN
    -- Obtener organización y sucursal de ejemplo
    SELECT id INTO test_org_id FROM organizations LIMIT 1;
    
    IF test_org_id IS NULL THEN
        RAISE NOTICE 'No hay organizaciones para probar';
        RETURN;
    END IF;
    
    SELECT id INTO test_branch_id FROM branches WHERE organization_id = test_org_id LIMIT 1;
    
    IF test_branch_id IS NULL THEN
        RAISE NOTICE 'No hay sucursales para probar';
        RETURN;
    END IF;
    
    -- Verificar si hay productos con inventario
    IF NOT EXISTS (
        SELECT 1 FROM products 
        WHERE organization_id = test_org_id 
        AND COALESCE(is_inventory_tracked, FALSE) = TRUE
    ) THEN
        RAISE NOTICE 'No hay productos con inventario habilitado';
        RETURN;
    END IF;
    
    -- Crear datos de prueba
    test_products := '[{"product_id": "' || (
        SELECT id FROM products 
        WHERE organization_id = test_org_id 
        AND COALESCE(is_inventory_tracked, FALSE) = TRUE
        LIMIT 1
    ) || '", "quantity": 10, "cost_price": 15.50}]';
    
    RAISE NOTICE 'Probando función con datos: org=%, branch=%, products=%', 
        test_org_id, test_branch_id, test_products;
    
    -- Probar función
    BEGIN
        SELECT * INTO result FROM register_purchase(
            test_org_id,
            test_branch_id,
            test_products,
            'Prueba automática de función'
        );
        
        RAISE NOTICE 'Resultado: success=%, message=%, movements=%', 
            result.success, result.message, result.movements_created;
            
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR probando función: %', SQLERRM;
    END;
END $$;

-- 5. Verificar configuración de inventario
SELECT 
    o.name as organization,
    COALESCE(s.inventory_enabled, FALSE) as inventory_enabled,
    COUNT(p.id) as total_products,
    COUNT(CASE WHEN p.is_inventory_tracked THEN 1 END) as tracked_products
FROM organizations o
LEFT JOIN inventory_settings s ON o.id = s.organization_id
LEFT JOIN products p ON o.id = p.organization_id
GROUP BY o.id, o.name, s.inventory_enabled
ORDER BY o.name;