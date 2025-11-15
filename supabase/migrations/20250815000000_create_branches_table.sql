-- Crear tabla de sucursales
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  is_main BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_branches_organization_id ON branches(organization_id);
CREATE INDEX idx_branches_is_main ON branches(is_main) WHERE is_main = TRUE;
CREATE INDEX idx_branches_is_active ON branches(is_active);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en branches
CREATE TRIGGER update_branches_updated_at 
    BEFORE UPDATE ON branches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) para branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver sucursales de su organización
CREATE POLICY "Users can view branches from their organization" ON branches
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Solo propietarios y administradores pueden insertar sucursales
CREATE POLICY "Owners and admins can insert branches" ON branches
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

-- Policy: Solo propietarios y administradores pueden actualizar sucursales
CREATE POLICY "Owners and admins can update branches" ON branches
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

-- Policy: Solo propietarios pueden eliminar sucursales
CREATE POLICY "Owners can delete branches" ON branches
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'propietario'
        )
    );

-- Agregar columna branch_id a profiles (para asignar usuarios a sucursales)
ALTER TABLE profiles ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Agregar columna branch_id a invoices
ALTER TABLE invoices ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Agregar columna branch_id a quotes  
ALTER TABLE quotes ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Crear función para asegurar que solo haya una sucursal principal por organización
CREATE OR REPLACE FUNCTION ensure_single_main_branch()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está marcando esta sucursal como principal
    IF NEW.is_main = TRUE THEN
        -- Quitar is_main de todas las otras sucursales de la misma organización
        UPDATE branches 
        SET is_main = FALSE 
        WHERE organization_id = NEW.organization_id 
        AND id != NEW.id 
        AND is_main = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para asegurar una sola sucursal principal
CREATE TRIGGER ensure_single_main_branch_trigger
    BEFORE INSERT OR UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_main_branch();

-- Comentarios para documentación
COMMENT ON TABLE branches IS 'Sucursales de las organizaciones';
COMMENT ON COLUMN branches.code IS 'Código único de la sucursal dentro de la organización';
COMMENT ON COLUMN branches.is_main IS 'Indica si es la sucursal principal de la organización';