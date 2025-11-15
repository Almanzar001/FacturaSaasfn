-- ARREGLAR TRIGGERS AUTOMÁTICOS (VERSION SIMPLIFICADA)

-- 1. Verificar triggers actuales
SELECT 
    'ESTADO DE TRIGGERS:' as info,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%';

-- 2. Eliminar triggers existentes
DROP TRIGGER IF EXISTS validate_stock_before_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS process_inventory_after_invoice_confirmation ON invoices;
DROP TRIGGER IF EXISTS revert_inventory_on_invoice_cancellation ON invoices;

-- 3. Recrear triggers con condiciones más específicas
CREATE TRIGGER validate_stock_before_invoice_confirmation
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND OLD.status NOT IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION validate_invoice_stock();

CREATE TRIGGER process_inventory_after_invoice_confirmation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND OLD.status NOT IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION process_invoice_inventory();

CREATE TRIGGER revert_inventory_on_invoice_cancellation
    AFTER UPDATE ON invoices
    FOR EACH ROW
    WHEN (OLD.status IN ('paid', 'completed', 'pagada', 'completada') 
          AND NEW.status IN ('cancelled', 'cancelada'))
    EXECUTE FUNCTION revert_invoice_inventory();

-- 4. Verificar que se crearon correctamente
SELECT 
    '✅ TRIGGERS RECREADOS:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%'
ORDER BY trigger_name;

-- 5. Mostrar mensaje final
DO $$
BEGIN
    RAISE NOTICE '🔧 Triggers recreados exitosamente';
    RAISE NOTICE '📝 Los triggers ahora se activarán cuando el status de una factura cambie a:';
    RAISE NOTICE '   - paid, completed, pagada, completada (procesará inventario)';
    RAISE NOTICE '   - cancelled, cancelada (revertirá inventario)';
    RAISE NOTICE '🎯 Las futuras ventas deberían procesarse automáticamente';
END $$;