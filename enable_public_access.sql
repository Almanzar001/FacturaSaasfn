-- HABILITAR ACCESO PÚBLICO TEMPORAL
-- ADVERTENCIA: Esto permite acceso sin autenticación a las tablas de inventario
-- Solo para debugging - luego hay que restringir

-- 1. Habilitar RLS nuevamente
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas que permitan acceso público para debugging
CREATE POLICY "temp_public_access_branches" ON branches
    FOR ALL USING (true);

CREATE POLICY "temp_public_access_inventory_settings" ON inventory_settings
    FOR ALL USING (true);

CREATE POLICY "temp_public_access_inventory_stock" ON inventory_stock
    FOR ALL USING (true);

CREATE POLICY "temp_public_access_inventory_movements" ON inventory_movements
    FOR ALL USING (true);

CREATE POLICY "temp_public_access_inventory_transfers" ON inventory_transfers
    FOR ALL USING (true);

CREATE POLICY "temp_public_access_inventory_transfer_items" ON inventory_transfer_items
    FOR ALL USING (true);

-- 3. Verificar que las políticas se crearon
SELECT 
    tablename,
    policyname,
    cmd as operations
FROM pg_policies 
WHERE tablename IN ('branches', 'inventory_settings', 'inventory_stock', 'inventory_movements', 'inventory_transfers', 'inventory_transfer_items')
ORDER BY tablename;

-- 4. Probar acceso con las nuevas políticas
DO $$
DECLARE
    test_org_id UUID := '79620cfb-c28b-4d70-98e3-aa932237b88e';
    branches_count INTEGER;
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO branches_count FROM branches WHERE organization_id = test_org_id;
    SELECT COUNT(*) INTO settings_count FROM inventory_settings WHERE organization_id = test_org_id;
    
    RAISE NOTICE 'Prueba con políticas públicas:';
    RAISE NOTICE 'Sucursales: % registros', branches_count;
    RAISE NOTICE 'Configuraciones: % registros', settings_count;
    
    IF branches_count > 0 AND settings_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Políticas públicas funcionan correctamente';
    END IF;
END $$;

COMMENT ON POLICY "temp_public_access_branches" ON branches IS 'TEMPORAL: Acceso público para debugging - ELIMINAR EN PRODUCCIÓN';
COMMENT ON POLICY "temp_public_access_inventory_settings" ON inventory_settings IS 'TEMPORAL: Acceso público para debugging - ELIMINAR EN PRODUCCIÓN';