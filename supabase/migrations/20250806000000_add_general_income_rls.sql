-- Configurar RLS para la tabla general_income

-- Habilitar RLS en la tabla
ALTER TABLE public.general_income ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Los usuarios pueden ver ingresos de su organización
CREATE POLICY "Users can view general_income from their organization" ON public.general_income
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Política para INSERT: Los usuarios pueden crear ingresos en su organización
CREATE POLICY "Users can insert general_income in their organization" ON public.general_income
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Política para UPDATE: Los usuarios pueden actualizar ingresos de su organización
CREATE POLICY "Users can update general_income from their organization" ON public.general_income
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Política para DELETE: Los usuarios pueden eliminar ingresos de su organización
CREATE POLICY "Users can delete general_income from their organization" ON public.general_income
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Comentario de confirmación
SELECT 'Políticas RLS configuradas para tabla general_income.' as mensaje;