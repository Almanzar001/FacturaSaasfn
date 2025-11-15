-- DIAGNÓSTICAR POR QUÉ LOS TRIGGERS NO FUNCIONAN

-- 1. Verificar que las funciones de trigger existan y sean válidas
SELECT 
    'FUNCIONES TRIGGER:' as info,
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as tiene_definicion
FROM information_schema.routines 
WHERE routine_name IN (
    'process_invoice_inventory',
    'validate_invoice_stock',
    'revert_invoice_inventory'
);

-- 2. Ver si hay errores en las funciones
SELECT 
    'VALIDACIÓN FUNCIONES:' as info,
    routine_name,
    CASE 
        WHEN routine_definition LIKE '%EXCEPTION%' THEN 'Tiene manejo errores'
        ELSE 'Sin manejo errores'
    END as error_handling
FROM information_schema.routines 
WHERE routine_name LIKE '%invoice_inventory%';

-- 3. Probar manualmente la función principal
DO $$
DECLARE
    test_result TEXT;
    latest_invoice RECORD;
BEGIN
    -- Obtener factura más reciente
    SELECT i.* INTO latest_invoice
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN products p ON ii.product_id = p.id
    WHERE p.name = 'Liquido Naranja 50ml'
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    RAISE NOTICE '🧪 PRUEBA MANUAL DE FUNCIÓN:';
    RAISE NOTICE 'Factura test: %', latest_invoice.invoice_number;
    RAISE NOTICE 'Status: %', latest_invoice.status;
    
    -- Intentar ejecutar la función manualmente
    BEGIN
        -- Simular NEW record para trigger
        -- Nota: No podemos llamar directamente las funciones trigger sin contexto
        RAISE NOTICE '⚠️  Las funciones trigger solo funcionan en contexto de UPDATE/INSERT';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error en función: %', SQLERRM;
    END;
    
END $$;

-- 4. Ver configuración actual de triggers
SELECT 
    'CONFIGURACIÓN TRIGGERS:' as info,
    trigger_name,
    event_manipulation,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'invoices'
AND trigger_name LIKE '%inventory%'
ORDER BY trigger_name;