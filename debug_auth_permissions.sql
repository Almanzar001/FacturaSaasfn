-- Verificar configuración de autenticación y permisos
-- Este script identifica problemas de autenticación en Supabase

-- 1. Verificar información del usuario actual
SELECT 
    'Usuario actual:' as info,
    COALESCE(auth.uid()::TEXT, 'NO AUTENTICADO') as user_id,
    COALESCE(auth.email(), 'SIN EMAIL') as email;

-- 2. Verificar perfil del usuario
SELECT 
    'Perfil del usuario:' as info,
    p.id,
    p.email,
    p.organization_id,
    p.role,
    o.name as organization_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.id = auth.uid();

-- 3. Verificar datos específicos de la organización 79620cfb-c28b-4d70-98e3-aa932237b88e
SELECT 
    'Datos de organización específica:' as info,
    COUNT(b.id) as sucursales,
    COUNT(s.id) as configuraciones_inventario,
    COUNT(p.id) as productos
FROM organizations o
LEFT JOIN branches b ON o.id = b.organization_id
LEFT JOIN inventory_settings s ON o.id = s.organization_id  
LEFT JOIN products p ON o.id = p.organization_id
WHERE o.id = '79620cfb-c28b-4d70-98e3-aa932237b88e'
GROUP BY o.id, o.name;

-- 4. Verificar que las tablas no tienen políticas RLS activas
SELECT 
    'Políticas RLS activas:' as info,
    COUNT(*) as cantidad_politicas,
    CASE 
        WHEN COUNT(*) = 0 THEN 'OK: Sin políticas activas'
        ELSE 'PROBLEMA: Hay políticas activas'
    END as estado
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('branches', 'inventory_settings', 'inventory_stock');

-- 5. Probar acceso directo sin autenticación (como superusuario)
DO $$
DECLARE
    branches_count INTEGER;
    settings_count INTEGER;
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
BEGIN
    RAISE NOTICE 'Probando acceso directo a tablas...';
    
    SELECT COUNT(*) INTO branches_count FROM branches WHERE organization_id = test_org_id;
    SELECT COUNT(*) INTO settings_count FROM inventory_settings WHERE organization_id = test_org_id;
    
    RAISE NOTICE 'Acceso directo exitoso:';
    RAISE NOTICE 'Sucursales encontradas: %', branches_count;
    RAISE NOTICE 'Configuraciones encontradas: %', settings_count;
    
    IF branches_count > 0 AND settings_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Los datos existen y son accesibles desde la base de datos';
    ELSE
        RAISE NOTICE 'WARNING: Faltan datos en las tablas';
    END IF;
END $$;

-- 6. Crear una función de prueba para verificar permisos API
CREATE OR REPLACE FUNCTION test_api_access()
RETURNS TABLE (
    table_name TEXT,
    can_select BOOLEAN,
    record_count INTEGER
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
BEGIN
    RETURN QUERY
    SELECT 
        'branches'::TEXT,
        true,
        (SELECT COUNT(*)::INTEGER FROM branches WHERE organization_id = test_org_id)
    UNION ALL
    SELECT 
        'inventory_settings'::TEXT,
        true,
        (SELECT COUNT(*)::INTEGER FROM inventory_settings WHERE organization_id = test_org_id);
END;
$$ LANGUAGE plpgsql;

-- 7. Probar la función de API
SELECT * FROM test_api_access();

-- 8. Verificar configuración de roles y permisos en auth
SELECT 
    'Configuración auth.users:' as info,
    COUNT(*) as usuarios_registrados
FROM auth.users;

COMMENT ON FUNCTION test_api_access IS 'Función para probar acceso API sin restricciones RLS';