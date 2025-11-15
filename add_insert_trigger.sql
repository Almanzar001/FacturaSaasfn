-- AGREGAR TRIGGER PARA FACTURAS CREADAS YA PAGADAS
-- Esto cubre el caso cuando el pago inicial = total y queda pagada inmediatamente

-- 1. Crear trigger para facturas nuevas que se insertan ya pagadas
CREATE OR REPLACE TRIGGER process_inventory_on_paid_invoice_insert
    AFTER INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION process_invoice_inventory();

-- 2. También crear trigger de validación para INSERT
CREATE OR REPLACE TRIGGER validate_stock_on_paid_invoice_insert
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.status IN ('paid', 'completed', 'pagada', 'completada'))
    EXECUTE FUNCTION validate_invoice_stock();

-- 3. Verificar todos los triggers de inventario
SELECT 
    '✅ TODOS LOS TRIGGERS:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name LIKE '%insert%' THEN '🆕 Facturas pagadas al crear'
        WHEN trigger_name LIKE '%confirmation%' THEN '💳 Cambio a pagada'
        WHEN trigger_name LIKE '%cancellation%' THEN '❌ Cancelación'
        ELSE '📝 Otro'
    END as descripcion
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND (trigger_name LIKE '%inventory%' OR trigger_name LIKE '%stock%')
ORDER BY trigger_name;

-- 4. Mensaje explicativo
DO $$
BEGIN
    RAISE NOTICE '🎯 TRIGGERS COMPLETOS INSTALADOS:';
    RAISE NOTICE '   ✅ INSERT: Facturas creadas ya pagadas (pago inicial = total)';
    RAISE NOTICE '   ✅ UPDATE: Facturas que cambian a pagadas después';
    RAISE NOTICE '   ✅ UPDATE: Facturas canceladas (revierte inventario)';
    RAISE NOTICE '';
    RAISE NOTICE '💰 Ahora cuando hagas una venta con pago completo:';
    RAISE NOTICE '   1. Se validará el stock antes de crear la factura';
    RAISE NOTICE '   2. Se descontará automáticamente del inventario';
    RAISE NOTICE '   3. Se registrará el movimiento de salida';
END $$;