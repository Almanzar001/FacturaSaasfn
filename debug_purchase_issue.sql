-- Script de diagnóstico completo para el problema de compras
-- Ejecutar este script para identificar exactamente qué está fallando

-- 1. Verificar que la función existe y tiene permisos
SELECT 
    'Estado de la función register_purchase:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname = 'register_purchase'
        ) THEN 'EXISTE'
        ELSE 'NO EXISTE'
    END as estado,
    CASE 
        WHEN has_function_privilege('anon', 'register_purchase(uuid, uuid, jsonb, text)', 'EXECUTE') 
        THEN 'PERMISOS OK'
        ELSE 'SIN PERMISOS'
    END as permisos;

-- 2. Verificar configuración de inventario por organización
SELECT 
    o.name as organizacion,
    o.id as org_id,
    COALESCE(s.inventory_enabled, FALSE) as inventario_habilitado,
    s.low_stock_threshold,
    s.auto_deduct_on_invoice,
    s.require_stock_validation
FROM organizations o
LEFT JOIN inventory_settings s ON o.id = s.organization_id
ORDER BY o.name;

-- 3. Verificar productos con inventario por organización
SELECT 
    o.name as organizacion,
    p.name as producto,
    p.id as product_id,
    COALESCE(p.is_inventory_tracked, FALSE) as tiene_inventario,
    p.sku,
    p.unit_of_measure
FROM organizations o
JOIN products p ON o.id = p.organization_id
WHERE COALESCE(p.is_inventory_tracked, FALSE) = TRUE
ORDER BY o.name, p.name;

-- 4. Verificar sucursales por organización
SELECT 
    o.name as organizacion,
    b.name as sucursal,
    b.id as branch_id,
    b.is_main as es_principal,
    b.is_active as activa
FROM organizations o
JOIN branches b ON o.id = b.organization_id
WHERE b.is_active = TRUE
ORDER BY o.name, b.is_main DESC, b.name;

-- 5. Verificar función register_inventory_movement
SELECT 
    'Estado de register_inventory_movement:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            WHERE p.proname = 'register_inventory_movement'
        ) THEN 'EXISTE'
        ELSE 'NO EXISTE'
    END as estado;

-- 6. Prueba manual de la función con datos reales
DO $$
DECLARE
    test_org_id UUID;
    test_branch_id UUID;
    test_product_id UUID;
    test_result JSONB;
    inventory_enabled BOOLEAN;
BEGIN
    -- Buscar una organización con inventario habilitado
    SELECT o.id, COALESCE(s.inventory_enabled, FALSE)
    INTO test_org_id, inventory_enabled
    FROM organizations o
    LEFT JOIN inventory_settings s ON o.id = s.organization_id
    WHERE COALESCE(s.inventory_enabled, FALSE) = TRUE
    LIMIT 1;
    
    IF test_org_id IS NULL THEN
        RAISE NOTICE 'ERROR: No hay organizaciones con inventario habilitado';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usando organización: % (inventario habilitado: %)', test_org_id, inventory_enabled;
    
    -- Buscar sucursal de esa organización
    SELECT id INTO test_branch_id
    FROM branches 
    WHERE organization_id = test_org_id 
    AND is_active = TRUE
    LIMIT 1;
    
    IF test_branch_id IS NULL THEN
        RAISE NOTICE 'ERROR: No hay sucursales activas para la organización';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usando sucursal: %', test_branch_id;
    
    -- Buscar producto con inventario de esa organización
    SELECT id INTO test_product_id
    FROM products 
    WHERE organization_id = test_org_id 
    AND COALESCE(is_inventory_tracked, FALSE) = TRUE
    LIMIT 1;
    
    IF test_product_id IS NULL THEN
        RAISE NOTICE 'ERROR: No hay productos con inventario para la organización';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usando producto: %', test_product_id;
    
    -- Probar la función
    BEGIN
        SELECT register_purchase(
            test_org_id,
            test_branch_id,
            ('[{"product_id": "' || test_product_id || '", "quantity": 10, "cost_price": 25.50}]')::JSONB,
            'Prueba de diagnóstico'
        ) INTO test_result;
        
        RAISE NOTICE 'RESULTADO DE LA PRUEBA: %', test_result;
        
        IF (test_result->>'success')::BOOLEAN THEN
            RAISE NOTICE 'SUCCESS: La función funciona correctamente';
        ELSE
            RAISE NOTICE 'ERROR EN FUNCIÓN: %', test_result->>'message';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'EXCEPCIÓN EN FUNCIÓN: %', SQLERRM;
    END;
END $$;

-- 7. Verificar movimientos recientes
SELECT 
    'Movimientos de inventario recientes:' as info,
    COUNT(*) as total_movimientos,
    MAX(created_at) as ultimo_movimiento
FROM inventory_movements
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 8. Mostrar últimos movimientos si existen
SELECT 
    im.movement_type,
    im.quantity,
    im.notes,
    p.name as producto,
    b.name as sucursal,
    im.created_at
FROM inventory_movements im
JOIN products p ON im.product_id = p.id
JOIN branches b ON im.branch_id = b.id
ORDER BY im.created_at DESC
LIMIT 5;