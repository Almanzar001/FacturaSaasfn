-- Script temporal para debuggear el problema de RLS
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar si la política existe y su configuración
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'providers' AND policyname = 'Users can manage providers in their organization';

-- 2. Verificar que RLS esté habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'providers';

-- 3. Probar la consulta manualmente (reemplaza 'your-user-id' con tu ID de usuario)
-- SELECT organization_id FROM profiles WHERE id = auth.uid();

-- 4. Ver todos los registros de la tabla providers (si tienes permisos de admin)
-- SELECT * FROM providers LIMIT 5;

-- 5. Verificar si hay datos en la tabla profiles para el usuario actual
-- SELECT id, organization_id FROM profiles WHERE id = auth.uid();
