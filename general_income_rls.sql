-- Habilitar RLS en la tabla general_income
ALTER TABLE general_income ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view general_income from their organization" ON general_income;
DROP POLICY IF EXISTS "Users can insert general_income in their organization" ON general_income;
DROP POLICY IF EXISTS "Users can update general_income from their organization" ON general_income;
DROP POLICY IF EXISTS "Users can delete general_income from their organization" ON general_income;

-- Política SELECT: Los usuarios pueden ver ingresos de su organización
CREATE POLICY "Users can view general_income from their organization" 
ON general_income FOR SELECT 
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

-- Política INSERT: Los usuarios pueden crear ingresos en su organización
CREATE POLICY "Users can insert general_income in their organization" 
ON general_income FOR INSERT 
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

-- Política UPDATE: Los usuarios pueden actualizar ingresos de su organización
CREATE POLICY "Users can update general_income from their organization" 
ON general_income FOR UPDATE 
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

-- Política DELETE: Los usuarios pueden eliminar ingresos de su organización
CREATE POLICY "Users can delete general_income from their organization" 
ON general_income FOR DELETE 
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
    )
);

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'general_income';