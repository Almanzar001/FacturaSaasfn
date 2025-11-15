-- ARREGLAR TRIGGERS AUTOMÁTICOS
-- Los triggers existen pero no están funcionando automáticamente

-- 1. Verificar si los triggers están activos en la tabla correcta
SELECT 
    'ESTADO DE TRIGGERS:' as info,
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%';

-- 2. Recrear los triggers para asegurar que funcionen
-- Primero eliminar triggers existentes
DROP TRIGGER IF EXISTS validate_stock_before_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS process_inventory_after_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS revert_inventory_on_invoice_cancellation ON invoices;

-- Recrear trigger de validación ANTES de confirmar
CREATE TRIGGER validate_stock_before_invoice_confirmation
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND OLD.status NOT IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION validate_invoice_stock();

-- Recrear trigger de procesamiento DESPUÉS de confirmar  
CREATE TRIGGER process_inventory_after_invoice_confirmation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND OLD.status NOT IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION process_invoice_inventory();

-- Recrear trigger de reversión al cancelar
CREATE TRIGGER revert_inventory_on_invoice_cancellation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    WHEN (OLD.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND NEW.status IN ('cancelled', 'cancelada'))
    EXECUTE FUNCTION revert_invoice_inventory();

-- 3. Verificar que se crearon correctamente
SELECT 
    '✅ TRIGGERS RECREADOS:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%'
ORDER BY trigger_name;

-- 4. Prueba: Crear una factura de prueba y cambiar su status
DO $$
DECLARE
    test_invoice_id UUID;
    org_id UUID;
    branch_id UUID;
    product_id UUID;
    customer_id UUID;
BEGIN
    -- Obtener IDs necesarios
    SELECT organization_id INTO org_id FROM products WHERE name = 'Liquido Naranja 50ml' LIMIT 1;
    SELECT id INTO branch_id FROM branches WHERE organization_id = org_id AND is_main = TRUE LIMIT 1;
    SELECT id INTO product_id FROM products WHERE name = 'Liquido Naranja 50ml' LIMIT 1;
    SELECT id INTO customer_id FROM customers WHERE organization_id = org_id LIMIT 1;
    
    -- Crear factura de prueba
    INSERT INTO invoices (
        organization_id, customer_id, branch_id,
        invoice_number, status, subtotal, tax_amount, total_amount, 
        currency, due_date, notes
    ) VALUES (
        org_id, customer_id, branch_id,
        'TEST-TRIGGER', 'draft', 50.00, 0.00, 50.00,
        'USD', NOW() + INTERVAL '30 days', 'Factura de prueba para triggers'
    ) RETURNING id INTO test_invoice_id;
    
    -- Agregar item a la factura
    INSERT INTO invoice_items (
        invoice_id, product_id, quantity, unit_price, total_price
    ) VALUES (
        test_invoice_id, product_id, 5, 10.00, 50.00
    );
    
    RAISE NOTICE '🧪 Factura de prueba creada: TEST-TRIGGER (ID: %)', test_invoice_id;
    
    -- Cambiar status a 'paid' para activar el trigger
    UPDATE invoices 
    SET status = 'paid', paid_at = NOW()
    WHERE id = test_invoice_id;
    
    RAISE NOTICE '💰 Factura marcada como pagada - los triggers deberían haberse ejecutado';
    
    -- Limpiar factura de prueba
    DELETE FROM invoice_items WHERE invoice_id = test_invoice_id;
    DELETE FROM invoices WHERE id = test_invoice_id;
    
    RAISE NOTICE '🧹 Factura de prueba eliminada';
    
END $$;

DO $$
BEGIN
    RAISE NOTICE '🔧 Triggers recreados y probados. Las futuras ventas deberían procesarse automáticamente.';
END $$;