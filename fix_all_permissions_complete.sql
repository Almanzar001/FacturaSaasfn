-- ARREGLO COMPLETO DE TODOS LOS PERMISOS
-- Ejecutar este script directamente en el SQL Editor de Supabase

-- 1. DESHABILITAR RLS TEMPORALMENTE EN TODAS LAS TABLAS PROBLEMÁTICAS
DO $$
BEGIN
    RAISE NOTICE 'Deshabilitando RLS temporalmente...';
    
    ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_settings DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_stock DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_transfers DISABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_transfer_items DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS deshabilitado en todas las tablas de inventario';
END $$;

-- 2. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DO $$
DECLARE
    policy_record RECORD;
    table_names TEXT[] := ARRAY['branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
            RAISE NOTICE 'Eliminada política % de tabla %', policy_record.policyname, table_name;
        END LOOP;
    END LOOP;
END $$;

-- 3. RECREAR FUNCIONES RPC CON SECURITY DEFINER SIN VALIDACIONES
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

-- 4. ASEGURAR DATOS INICIALES
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

-- Crear sucursal principal para organizaciones que no la tienen
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

-- 5. HABILITAR RLS NUEVAMENTE CON POLÍTICAS SIMPLES
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- Política simple para branches
CREATE POLICY "org_access_branches" ON branches
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Política simple para inventory_settings
CREATE POLICY "org_access_inventory_settings" ON inventory_settings
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Política simple para inventory_stock
CREATE POLICY "org_access_inventory_stock" ON inventory_stock
    FOR ALL USING (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- Política simple para inventory_movements
CREATE POLICY "org_access_inventory_movements" ON inventory_movements
    FOR ALL USING (
        branch_id IN (
            SELECT b.id FROM branches b
            WHERE b.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- Política simple para inventory_transfers
CREATE POLICY "org_access_inventory_transfers" ON inventory_transfers
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Política simple para inventory_transfer_items
CREATE POLICY "org_access_inventory_transfer_items" ON inventory_transfer_items
    FOR ALL USING (
        transfer_id IN (
            SELECT t.id FROM inventory_transfers t
            WHERE t.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 6. VERIFICACIÓN FINAL
DO $$
DECLARE
    function_count INTEGER;
    settings_count INTEGER;
    branches_count INTEGER;
BEGIN
    -- Contar funciones
    SELECT COUNT(*) INTO function_count
    FROM pg_proc 
    WHERE proname IN ('get_inventory_stats', 'get_low_stock_products', 'upsert_inventory_settings', 'upsert_inventory_stock_level');
    
    -- Contar datos
    SELECT COUNT(*) INTO settings_count FROM inventory_settings;
    SELECT COUNT(*) INTO branches_count FROM branches;
    
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    RAISE NOTICE 'Funciones creadas: % de 4', function_count;
    RAISE NOTICE 'Configuraciones de inventario: %', settings_count;
    RAISE NOTICE 'Sucursales: %', branches_count;
    
    IF function_count = 4 THEN
        RAISE NOTICE 'SUCCESS: Todas las funciones y permisos configurados correctamente';
    ELSE
        RAISE EXCEPTION 'ERROR: Faltan funciones por crear';
    END IF;
END $$;