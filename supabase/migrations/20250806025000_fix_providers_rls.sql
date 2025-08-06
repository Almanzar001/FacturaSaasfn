-- Actualizar políticas RLS para la tabla providers
-- Eliminar las políticas existentes
DROP POLICY IF EXISTS "Enable read access for organization members" ON public.providers;
DROP POLICY IF EXISTS "Enable insert access for organization members" ON public.providers;
DROP POLICY IF EXISTS "Enable update access for organization members" ON public.providers;
DROP POLICY IF EXISTS "Enable delete access for organization members" ON public.providers;

-- Crear una política unificada más simple (igual que la de clients)
CREATE POLICY "Users can manage providers in their organization" ON public.providers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Comentario de confirmación
SELECT 'Políticas RLS de proveedores actualizadas exitosamente.' as mensaje;
