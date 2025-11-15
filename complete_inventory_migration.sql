-- MIGRACIÓN COMPLETA: SISTEMA DE INVENTARIO Y SUCURSALES
-- Ejecutar todo este script de una vez en el SQL Editor de Supabase

-- ============================================================================
-- PARTE 1: CREAR TABLA DE SUCURSALES
-- ============================================================================

-- Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS branches (
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
CREATE INDEX IF NOT EXISTS idx_branches_organization_id ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_main ON branches(is_main) WHERE is_main = TRUE;
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en branches
DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;
CREATE TRIGGER update_branches_updated_at 
    BEFORE UPDATE ON branches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Agregar columnas a tablas existentes (solo si no existen)
DO $$
BEGIN
    -- Agregar branch_id a profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'branch_id') THEN
        ALTER TABLE profiles ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;

    -- Agregar branch_id a invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'branch_id') THEN
        ALTER TABLE invoices ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;

    -- Agregar branch_id a quotes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'branch_id') THEN
        ALTER TABLE quotes ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Función para asegurar que solo haya una sucursal principal por organización
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
DROP TRIGGER IF EXISTS ensure_single_main_branch_trigger ON branches;
CREATE TRIGGER ensure_single_main_branch_trigger
    BEFORE INSERT OR UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_main_branch();

-- ============================================================================
-- PARTE 2: CREAR SISTEMA DE INVENTARIO
-- ============================================================================

-- Agregar campos de inventario a la tabla products (solo si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_inventory_tracked') THEN
        ALTER TABLE products ADD COLUMN is_inventory_tracked BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku') THEN
        ALTER TABLE products ADD COLUMN sku VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unit_of_measure') THEN
        ALTER TABLE products ADD COLUMN unit_of_measure VARCHAR(50) DEFAULT 'unidad';
    END IF;
END $$;

-- Crear índices en products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_inventory_tracked ON products(is_inventory_tracked);

-- Tabla de configuración de inventario por organización
CREATE TABLE IF NOT EXISTS inventory_settings (
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
CREATE TABLE IF NOT EXISTS inventory_stock (
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
CREATE TABLE IF NOT EXISTS inventory_movements (
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
CREATE TABLE IF NOT EXISTS inventory_transfers (
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
CREATE TABLE IF NOT EXISTS inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para inventario
CREATE INDEX IF NOT EXISTS idx_inventory_settings_organization_id ON inventory_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_product_branch ON inventory_stock(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_branch ON inventory_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_low_stock ON inventory_stock(branch_id) WHERE quantity <= min_stock;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_organization ON inventory_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_branch ON inventory_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_branch ON inventory_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON inventory_transfers(status);

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer ON inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_product ON inventory_transfer_items(product_id);

-- Triggers para updated_at en tablas de inventario
DROP TRIGGER IF EXISTS update_inventory_settings_updated_at ON inventory_settings;
CREATE TRIGGER update_inventory_settings_updated_at 
    BEFORE UPDATE ON inventory_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_stock_updated_at ON inventory_stock;
CREATE TRIGGER update_inventory_stock_updated_at 
    BEFORE UPDATE ON inventory_stock 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_transfers_updated_at ON inventory_transfers;
CREATE TRIGGER update_inventory_transfers_updated_at 
    BEFORE UPDATE ON inventory_transfers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 3: CONFIGURACIÓN INICIAL Y FUNCIONES
-- ============================================================================

-- Crear sucursal principal para organizaciones existentes
INSERT INTO branches (organization_id, name, code, is_main, is_active)
SELECT 
    id,
    name || ' - Principal',
    'PRINCIPAL',
    TRUE,
    TRUE
FROM organizations
WHERE id NOT IN (SELECT DISTINCT organization_id FROM branches WHERE is_main = TRUE)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Crear configuración de inventario para organizaciones existentes
INSERT INTO inventory_settings (organization_id, inventory_enabled, low_stock_threshold, auto_deduct_on_invoice, require_stock_validation)
SELECT 
    id,
    FALSE,
    10,
    TRUE,
    TRUE
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM inventory_settings)
ON CONFLICT (organization_id) DO NOTHING;

-- Función para configurar automáticamente nuevas organizaciones
CREATE OR REPLACE FUNCTION setup_new_organization()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear sucursal principal automáticamente
    INSERT INTO branches (organization_id, name, code, is_main, is_active)
    VALUES (NEW.id, NEW.name || ' - Principal', 'PRINCIPAL', TRUE, TRUE)
    ON CONFLICT (organization_id, code) DO NOTHING;
    
    -- Crear configuración de inventario deshabilitada por defecto
    INSERT INTO inventory_settings (organization_id, inventory_enabled)
    VALUES (NEW.id, FALSE)
    ON CONFLICT (organization_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para configurar automáticamente nuevas organizaciones
DROP TRIGGER IF EXISTS setup_new_organization_trigger ON organizations;
CREATE TRIGGER setup_new_organization_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION setup_new_organization();

-- Función para obtener estadísticas de inventario
CREATE OR REPLACE FUNCTION get_inventory_stats(org_id UUID)
RETURNS TABLE (
    total_products INTEGER,
    tracked_products INTEGER,
    low_stock_items INTEGER,
    total_branches INTEGER,
    inventory_enabled BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id),
        (SELECT COUNT(*)::INTEGER FROM products WHERE organization_id = org_id AND COALESCE(is_inventory_tracked, false) = true),
        (SELECT COUNT(*)::INTEGER 
         FROM inventory_stock s 
         JOIN branches b ON s.branch_id = b.id 
         WHERE b.organization_id = org_id AND s.quantity <= COALESCE(s.min_stock, 0)),
        (SELECT COUNT(*)::INTEGER FROM branches WHERE organization_id = org_id AND COALESCE(is_active, true) = true),
        (SELECT COALESCE(inventory_enabled, false) FROM inventory_settings WHERE organization_id = org_id);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener productos con bajo stock
CREATE OR REPLACE FUNCTION get_low_stock_products(org_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    branch_id UUID,
    branch_name VARCHAR(255),
    current_stock INTEGER,
    min_stock INTEGER,
    sku VARCHAR(100)
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        b.id,
        b.name,
        s.quantity,
        COALESCE(s.min_stock, 0),
        p.sku
    FROM inventory_stock s
    JOIN products p ON s.product_id = p.id
    JOIN branches b ON s.branch_id = b.id
    WHERE b.organization_id = org_id 
    AND s.quantity <= COALESCE(s.min_stock, 0)
    AND COALESCE(p.is_inventory_tracked, false) = true
    ORDER BY (s.quantity - COALESCE(s.min_stock, 0)), p.name;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar movimiento de inventario
CREATE OR REPLACE FUNCTION register_inventory_movement(
    p_product_id UUID,
    p_branch_id UUID,
    p_movement_type VARCHAR(50),
    p_quantity INTEGER,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_cost_price DECIMAL(10,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    movement_id UUID;
    current_stock INTEGER := 0;
    new_stock INTEGER;
BEGIN
    -- Obtener stock actual
    SELECT COALESCE(quantity, 0) INTO current_stock
    FROM inventory_stock
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    -- Calcular nuevo stock
    new_stock := current_stock + p_quantity;
    
    -- Validar que el stock no sea negativo
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, Cantidad requerida: %', current_stock, ABS(p_quantity);
    END IF;
    
    -- Insertar el movimiento
    INSERT INTO inventory_movements (
        product_id, 
        branch_id, 
        movement_type, 
        quantity, 
        previous_quantity, 
        new_quantity,
        reference_type, 
        reference_id, 
        cost_price,
        notes, 
        user_id
    ) VALUES (
        p_product_id,
        p_branch_id,
        p_movement_type,
        p_quantity,
        current_stock,
        new_stock,
        p_reference_type,
        p_reference_id,
        p_cost_price,
        p_notes,
        auth.uid()
    ) RETURNING id INTO movement_id;
    
    RETURN movement_id;
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

-- Trigger para actualizar stock automáticamente
DROP TRIGGER IF EXISTS update_stock_on_movement ON inventory_movements;
CREATE TRIGGER update_stock_on_movement
    AFTER INSERT ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_stock();

-- Función para upsert de configuración de inventario
CREATE OR REPLACE FUNCTION upsert_inventory_settings(
    p_organization_id UUID,
    p_inventory_enabled BOOLEAN DEFAULT NULL,
    p_low_stock_threshold INTEGER DEFAULT NULL,
    p_auto_deduct_on_invoice BOOLEAN DEFAULT NULL,
    p_require_stock_validation BOOLEAN DEFAULT NULL
)
RETURNS inventory_settings 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result inventory_settings;
BEGIN
    -- Intentar actualizar primero
    UPDATE inventory_settings 
    SET 
        inventory_enabled = COALESCE(p_inventory_enabled, inventory_enabled),
        low_stock_threshold = COALESCE(p_low_stock_threshold, low_stock_threshold),
        auto_deduct_on_invoice = COALESCE(p_auto_deduct_on_invoice, auto_deduct_on_invoice),
        require_stock_validation = COALESCE(p_require_stock_validation, require_stock_validation),
        updated_at = NOW()
    WHERE organization_id = p_organization_id
    RETURNING * INTO result;

    -- Si no existe, crear uno nuevo
    IF NOT FOUND THEN
        INSERT INTO inventory_settings (
            organization_id,
            inventory_enabled,
            low_stock_threshold,
            auto_deduct_on_invoice,
            require_stock_validation
        ) VALUES (
            p_organization_id,
            COALESCE(p_inventory_enabled, FALSE),
            COALESCE(p_low_stock_threshold, 10),
            COALESCE(p_auto_deduct_on_invoice, TRUE),
            COALESCE(p_require_stock_validation, TRUE)
        )
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar stock de forma segura
CREATE OR REPLACE FUNCTION upsert_inventory_stock_level(
    p_stock_id UUID,
    p_field_name TEXT,
    p_value NUMERIC
)
RETURNS inventory_stock 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result inventory_stock;
BEGIN
    -- Validar campo
    IF p_field_name NOT IN ('min_stock', 'max_stock', 'cost_price') THEN
        RAISE EXCEPTION 'Campo no válido: %', p_field_name;
    END IF;

    -- Actualizar según el campo
    IF p_field_name = 'min_stock' THEN
        UPDATE inventory_stock 
        SET min_stock = p_value::INTEGER, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    ELSIF p_field_name = 'max_stock' THEN
        UPDATE inventory_stock 
        SET max_stock = CASE WHEN p_value = 0 THEN NULL ELSE p_value::INTEGER END, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    ELSIF p_field_name = 'cost_price' THEN
        UPDATE inventory_stock 
        SET cost_price = p_value, updated_at = NOW()
        WHERE id = p_stock_id
        RETURNING * INTO result;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 4: CONFIGURAR RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Users can view branches from their organization" ON branches;
DROP POLICY IF EXISTS "Owners and admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Owners and admins can update branches" ON branches;
DROP POLICY IF EXISTS "Owners can delete branches" ON branches;
DROP POLICY IF EXISTS "allow_all_for_org_users" ON branches;

-- Políticas simplificadas para branches
CREATE POLICY "Allow access to organization branches" ON branches
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Limpiar políticas de inventory_settings
DROP POLICY IF EXISTS "Users can view inventory settings from their organization" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can insert inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners and admins can update inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "Owners can delete inventory settings" ON inventory_settings;
DROP POLICY IF EXISTS "allow_all_for_org_users" ON inventory_settings;

-- Políticas para inventory_settings
CREATE POLICY "Allow access to organization inventory settings" ON inventory_settings
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Políticas para inventory_stock
CREATE POLICY "Allow access to organization inventory stock" ON inventory_stock
    FOR ALL USING (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- Políticas para inventory_movements
CREATE POLICY "Allow access to organization inventory movements" ON inventory_movements
    FOR ALL USING (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- Políticas para inventory_transfers
CREATE POLICY "Allow access to organization inventory transfers" ON inventory_transfers
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Políticas para inventory_transfer_items
CREATE POLICY "Allow access to organization transfer items" ON inventory_transfer_items
    FOR ALL USING (
        transfer_id IN (
            SELECT t.id FROM inventory_transfers t
            WHERE t.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        transfer_id IN (
            SELECT t.id FROM inventory_transfers t
            WHERE t.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Contar tablas creadas
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items');
    
    -- Contar funciones creadas
    SELECT COUNT(*) INTO function_count
    FROM pg_proc 
    WHERE proname IN ('get_inventory_stats', 'get_low_stock_products', 'register_inventory_movement', 'upsert_inventory_settings', 'upsert_inventory_stock_level');
    
    RAISE NOTICE '=== MIGRACIÓN COMPLETADA ===';
    RAISE NOTICE 'Tablas creadas: % de 6', table_count;
    RAISE NOTICE 'Funciones creadas: % de 5', function_count;
    
    IF table_count = 6 AND function_count = 5 THEN
        RAISE NOTICE 'SUCCESS: Sistema de inventario y sucursales instalado correctamente';
    ELSE
        RAISE EXCEPTION 'ERROR: Migración incompleta. Tablas: %, Funciones: %', table_count, function_count;
    END IF;
END $$;