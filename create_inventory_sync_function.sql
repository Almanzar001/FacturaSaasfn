-- CREAR FUNCIÓN PARA SINCRONIZAR INVENTARIO MANUALMENTE
-- Esta función se puede llamar periódicamente para procesar ventas pendientes

CREATE OR REPLACE FUNCTION sync_inventory_with_sales()
RETURNS JSONB AS $$
DECLARE
    processed_invoices INTEGER := 0;
    processed_items INTEGER := 0;
    invoice_record RECORD;
    item_record RECORD;
    branch_id_to_use UUID;
    movement_id UUID;
    result JSONB;
BEGIN
    -- Buscar todas las facturas pagadas sin procesar
    FOR invoice_record IN 
        SELECT DISTINCT i.id, i.invoice_number, i.organization_id, i.branch_id, i.created_at
        FROM invoices i
        JOIN invoice_items ii ON i.id = ii.invoice_id
        JOIN products p ON ii.product_id = p.id
        WHERE i.status IN ('paid', 'completed', 'pagada', 'completada')
        AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
        AND NOT EXISTS (
            SELECT 1 FROM inventory_movements im 
            WHERE im.reference_type = 'factura' 
            AND im.reference_id = i.id
        )
        -- Solo facturas de las últimas 24 horas para evitar procesar todo el historial
        AND i.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY i.created_at
    LOOP
        -- Verificar que el inventario esté habilitado para esta organización
        IF EXISTS (
            SELECT 1 FROM inventory_settings 
            WHERE organization_id = invoice_record.organization_id 
            AND inventory_enabled = TRUE
        ) THEN
            -- Determinar sucursal
            branch_id_to_use := invoice_record.branch_id;
            IF branch_id_to_use IS NULL THEN
                SELECT id INTO branch_id_to_use
                FROM branches 
                WHERE organization_id = invoice_record.organization_id 
                AND is_main = TRUE 
                LIMIT 1;
            END IF;
            
            -- Procesar items con inventario
            FOR item_record IN 
                SELECT ii.product_id, ii.quantity, ii.unit_price, p.name as product_name
                FROM invoice_items ii
                JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = invoice_record.id
                AND COALESCE(p.is_inventory_tracked, FALSE) = TRUE
            LOOP
                BEGIN
                    SELECT register_inventory_movement(
                        item_record.product_id,
                        branch_id_to_use,
                        'salida',
                        -item_record.quantity,  -- Negativo para salida
                        'factura',
                        invoice_record.id,
                        item_record.unit_price,
                        'Sincronización automática - Factura #' || invoice_record.invoice_number
                    ) INTO movement_id;
                    
                    processed_items := processed_items + 1;
                    
                EXCEPTION WHEN OTHERS THEN
                    -- Registrar error pero continuar
                    INSERT INTO inventory_movements (
                        product_id, branch_id, movement_type, quantity,
                        reference_type, reference_id, notes, user_id, movement_date
                    ) VALUES (
                        item_record.product_id, branch_id_to_use, 'error', 0,
                        'sync_error', invoice_record.id, 
                        'Error sincronizando: ' || SQLERRM,
                        NULL, NOW()
                    );
                END;
            END LOOP;
            
            processed_invoices := processed_invoices + 1;
        END IF;
    END LOOP;
    
    -- Retornar resultado
    result := jsonb_build_object(
        'success', TRUE,
        'processed_invoices', processed_invoices,
        'processed_items', processed_items,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION sync_inventory_with_sales() TO authenticated, anon, service_role;

-- Crear función para llamar desde la aplicación
CREATE OR REPLACE FUNCTION manual_inventory_sync()
RETURNS JSONB AS $$
BEGIN
    RETURN sync_inventory_with_sales();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION manual_inventory_sync() TO authenticated, anon, service_role;

-- Comentarios
COMMENT ON FUNCTION sync_inventory_with_sales IS 'Sincroniza inventario con facturas pagadas que no fueron procesadas automáticamente';
COMMENT ON FUNCTION manual_inventory_sync IS 'Función pública para sincronizar inventario manualmente desde la aplicación';

-- Mensaje
DO $$
BEGIN
    RAISE NOTICE '🔄 FUNCIÓN DE SINCRONIZACIÓN CREADA';
    RAISE NOTICE '   - sync_inventory_with_sales(): Procesa ventas pendientes';
    RAISE NOTICE '   - manual_inventory_sync(): Versión pública para la app';
    RAISE NOTICE '   - Procesa solo facturas de las últimas 24 horas';
    RAISE NOTICE '   - Se puede llamar periódicamente desde la aplicación';
END $$;