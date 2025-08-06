-- Corregir permisos para tabla expenses
-- Otorgar permisos básicos de PostgreSQL para la tabla expenses

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verificar que las políticas RLS existen (solo crear si no existen)
DO $$
BEGIN
  -- Verificar si la política ya existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'expenses' 
    AND policyname = 'Users can manage expenses in their organization'
  ) THEN
    -- Crear la política RLS si no existe
    CREATE POLICY "Users can manage expenses in their organization" ON public.expenses
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Asegurar que RLS está habilitado
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Comentario de confirmación
SELECT 'Permisos de tabla expenses corregidos exitosamente.' as mensaje;
