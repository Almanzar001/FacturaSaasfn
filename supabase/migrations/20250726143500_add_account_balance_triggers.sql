-- Migración para actualizar el balance de las cuentas automáticamente cuando se realizan pagos

-- Función para actualizar el balance de una cuenta basado en los pagos
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    target_account_id UUID;
    total_payments DECIMAL(10,2);
BEGIN
    -- Determinar qué account_id actualizar basado en la operación
    IF TG_OP = 'DELETE' THEN
        target_account_id := OLD.account_id;
    ELSE
        target_account_id := NEW.account_id;
    END IF;

    -- Solo proceder si hay un account_id válido
    IF target_account_id IS NOT NULL THEN
        -- Calcular total de pagos para esta cuenta
        SELECT COALESCE(SUM(amount), 0) INTO total_payments
        FROM payments 
        WHERE account_id = target_account_id;

        -- Actualizar el balance de la cuenta
        UPDATE accounts 
        SET 
            balance = total_payments,
            updated_at = NOW()
        WHERE id = target_account_id;
    END IF;

    -- Retornar el registro apropiado basado en la operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para la tabla payments que actualice el balance de las cuentas
DROP TRIGGER IF EXISTS trigger_update_account_balance ON payments;
CREATE TRIGGER trigger_update_account_balance
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance();

-- Inicializar balance para cuentas existentes basado en pagos históricos
UPDATE accounts 
SET balance = COALESCE((
    SELECT SUM(amount) 
    FROM payments 
    WHERE payments.account_id = accounts.id
), 0)
WHERE id IN (
    SELECT DISTINCT account_id 
    FROM payments 
    WHERE account_id IS NOT NULL
);

-- También actualizar cuentas que no tienen pagos para asegurar que tengan balance 0
UPDATE accounts 
SET balance = 0
WHERE id NOT IN (
    SELECT DISTINCT account_id 
    FROM payments 
    WHERE account_id IS NOT NULL
);

-- Función para obtener estadísticas de cuentas (opcional, para reportes)
CREATE OR REPLACE FUNCTION get_account_stats(p_organization_id UUID)
RETURNS TABLE (
    account_id UUID,
    account_name TEXT,
    account_type TEXT,
    total_balance DECIMAL(10,2),
    payment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as account_id,
        a.name as account_name,
        a.type as account_type,
        a.balance as total_balance,
        COALESCE(p.payment_count, 0) as payment_count
    FROM accounts a
    LEFT JOIN (
        SELECT 
            account_id,
            COUNT(*) as payment_count
        FROM payments 
        WHERE account_id IS NOT NULL
        GROUP BY account_id
    ) p ON a.id = p.account_id
    WHERE a.organization_id = p_organization_id
    ORDER BY a.name;
END;
$$ LANGUAGE plpgsql;

-- Comentario de confirmación
SELECT 'Migración de balance de cuentas aplicada exitosamente. Los balances de las cuentas ahora se actualizarán automáticamente con los pagos.' as mensaje;