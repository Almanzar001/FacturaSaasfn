-- Agregar campos de inventario a la tabla products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_inventory_tracked BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50) DEFAULT 'unidad';

-- Crear índice en sku para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_inventory_tracked ON products(is_inventory_tracked);

-- Tabla de configuración de inventario por organización
CREATE TABLE inventory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  inventory_enabled BOOLEAN DEFAULT FALSE,
  low_stock_threshold INTEGER DEFAULT 10,
  auto_deduct_on_invoice BOOLEAN DEFAULT TRUE,
  require_stock_validation BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock de productos por sucursal
CREATE TABLE inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER,
  cost_price DECIMAL(10,2) DEFAULT 0,
  last_movement_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, branch_id),
  CONSTRAINT check_positive_quantities CHECK (
    quantity >= 0 AND 
    reserved_quantity >= 0 AND 
    min_stock >= 0 AND
    cost_price >= 0
  )
);

-- Movimientos de inventario (auditoría completa)
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'transferencia_salida', 'transferencia_entrada')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL DEFAULT 0,
  new_quantity INTEGER NOT NULL DEFAULT 0,
  reference_type VARCHAR(50) CHECK (reference_type IN ('factura', 'compra', 'ajuste', 'transferencia', 'inicial')),
  reference_id UUID,
  cost_price DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transferencias entre sucursales
CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  transfer_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_transito', 'completado', 'cancelado')),
  transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_branches CHECK (from_branch_id != to_branch_id)
);

-- Detalles de transferencias
CREATE TABLE inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_inventory_settings_organization_id ON inventory_settings(organization_id);
CREATE INDEX idx_inventory_stock_product_branch ON inventory_stock(product_id, branch_id);
CREATE INDEX idx_inventory_stock_branch ON inventory_stock(branch_id);
CREATE INDEX idx_inventory_stock_low_stock ON inventory_stock(branch_id) WHERE quantity <= min_stock;

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

CREATE INDEX idx_inventory_transfers_organization ON inventory_transfers(organization_id);
CREATE INDEX idx_inventory_transfers_from_branch ON inventory_transfers(from_branch_id);
CREATE INDEX idx_inventory_transfers_to_branch ON inventory_transfers(to_branch_id);
CREATE INDEX idx_inventory_transfers_status ON inventory_transfers(status);

CREATE INDEX idx_inventory_transfer_items_transfer ON inventory_transfer_items(transfer_id);
CREATE INDEX idx_inventory_transfer_items_product ON inventory_transfer_items(product_id);

-- Triggers para updated_at
CREATE TRIGGER update_inventory_settings_updated_at 
    BEFORE UPDATE ON inventory_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_stock_updated_at 
    BEFORE UPDATE ON inventory_stock 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_transfers_updated_at 
    BEFORE UPDATE ON inventory_transfers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) para todas las tablas de inventario
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- Policies para inventory_settings
CREATE POLICY "Users can view inventory settings from their organization" ON inventory_settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Owners and admins can manage inventory settings" ON inventory_settings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('propietario', 'administrador')
        )
    );

-- Policies para inventory_stock
CREATE POLICY "Users can view inventory stock from their organization" ON inventory_stock
    FOR SELECT USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage inventory stock from their organization" ON inventory_stock
    FOR ALL USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador', 'vendedor')
        )
    );

-- Policies para inventory_movements
CREATE POLICY "Users can view inventory movements from their organization" ON inventory_movements
    FOR SELECT USING (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can insert inventory movements" ON inventory_movements
    FOR INSERT WITH CHECK (
        branch_id IN (
            SELECT b.id 
            FROM branches b
            JOIN profiles p ON b.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador', 'vendedor')
        )
    );

-- Policies para inventory_transfers
CREATE POLICY "Users can view transfers from their organization" ON inventory_transfers
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage transfers from their organization" ON inventory_transfers
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()
            AND role IN ('propietario', 'administrador', 'vendedor')
        )
    );

-- Policies para inventory_transfer_items
CREATE POLICY "Users can view transfer items from their organization" ON inventory_transfer_items
    FOR SELECT USING (
        transfer_id IN (
            SELECT t.id 
            FROM inventory_transfers t
            JOIN profiles p ON t.organization_id = p.organization_id
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage transfer items from their organization" ON inventory_transfer_items
    FOR ALL USING (
        transfer_id IN (
            SELECT t.id 
            FROM inventory_transfers t
            JOIN profiles p ON t.organization_id = p.organization_id
            WHERE p.id = auth.uid()
            AND p.role IN ('propietario', 'administrador', 'vendedor')
        )
    );

-- Función para generar número de transferencia automático
CREATE OR REPLACE FUNCTION generate_transfer_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    transfer_number TEXT;
BEGIN
    -- Obtener el siguiente número de la secuencia
    SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_number FROM 'TRANS-(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM inventory_transfers 
    WHERE organization_id = org_id
    AND transfer_number SIMILAR TO 'TRANS-\d+';
    
    -- Generar el número con formato
    transfer_number := 'TRANS-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN transfer_number;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar stock automáticamente
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el stock y la fecha del último movimiento
    UPDATE inventory_stock 
    SET 
        quantity = NEW.new_quantity,
        last_movement_date = NEW.movement_date,
        updated_at = NOW()
    WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id;
    
    -- Si no existe el registro de stock, crearlo
    IF NOT FOUND THEN
        INSERT INTO inventory_stock (product_id, branch_id, quantity, last_movement_date)
        VALUES (NEW.product_id, NEW.branch_id, NEW.new_quantity, NEW.movement_date);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock automáticamente cuando se inserta un movimiento
CREATE TRIGGER update_stock_on_movement
    AFTER INSERT ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_stock();

-- Comentarios para documentación
COMMENT ON TABLE inventory_settings IS 'Configuración de inventario por organización';
COMMENT ON TABLE inventory_stock IS 'Stock de productos por sucursal';
COMMENT ON TABLE inventory_movements IS 'Registro de todos los movimientos de inventario';
COMMENT ON TABLE inventory_transfers IS 'Transferencias entre sucursales';
COMMENT ON TABLE inventory_transfer_items IS 'Detalles de los productos en cada transferencia';