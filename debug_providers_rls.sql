-- Verificar el estado actual de las políticas RLS para providers
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'providers';

-- Verificar si RLS está habilitado en la tabla
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'providers';

-- Verificar la estructura de la tabla providers
\d public.providers;
