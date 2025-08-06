-- Solución para el error 42501 - permission denied
-- Otorgar permisos básicos a la tabla providers para usuarios autenticados

-- Verificar permisos actuales
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'providers';

-- Otorgar permisos básicos a usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;

-- Otorgar permisos para usar secuencias (si las hay)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verificar que los permisos se otorgaron correctamente
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'providers'
AND grantee = 'authenticated';

-- Comentario de confirmación
SELECT 'Permisos de tabla providers otorgados correctamente.' as mensaje;
