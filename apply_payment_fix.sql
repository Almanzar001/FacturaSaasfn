-- Script para aplicar la corrección de pagos de facturas
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Agregar columnas faltantes a la tabla invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type_id UUID;

-- 2. Agregar columnas faltantes a la tabla invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Crear tabla document_types si no existe
CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    sequence_next_value INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insertar tipos de documento por defecto para organizaciones existentes
INSERT INTO document_types (organization_id, name, prefix, sequence_next_value, is_active)
SELECT 
    id as organization_id,
    'Factura de Crédito Fiscal' as name,
    'B01' as prefix,
    1 as sequence_next_value,
    true as is_active
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM document_types WHERE document_types.organization_id = organizations.id
);

-- 5. Crear función para actualizar balance de facturas
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(10,2);
    total_payments DECIMAL(10,2);
    new_balance DECIMAL(10,2);
    target_invoice_id UUID;
BEGIN
    -- Determinar qué invoice_id actualizar basado en la operación
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;

    -- Obtener el total de la factura
    SELECT total INTO invoice_total 
    FROM invoices 
    WHERE id = target_invoice_id;

    -- Calcular total de pagos para esta factura
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments 
    WHERE invoice_id = target_invoice_id;

    -- Calcular nuevo balance
    new_balance := invoice_total - total_payments;

    -- Actualizar el balance y estado de la factura
    UPDATE invoices 
    SET 
        balance = new_balance,
        status = CASE 
            WHEN new_balance <= 0 THEN 'paid'
            WHEN new_balance < total THEN 'partially_paid'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = target_invoice_id;

    -- Retornar el registro apropiado basado en la operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para la tabla payments
DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON payments;
CREATE TRIGGER trigger_update_invoice_balance
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_balance();

-- 7. Inicializar balance para facturas existentes
UPDATE invoices 
SET balance = total - COALESCE((
    SELECT SUM(amount) 
    FROM payments 
    WHERE payments.invoice_id = invoices.id
), 0)
WHERE balance IS NULL OR balance = 0;

-- 8. Actualizar estado basado en balance para facturas existentes
UPDATE invoices 
SET status = CASE 
    WHEN balance <= 0 THEN 'paid'
    WHEN balance < total THEN 'partially_paid'
    ELSE status
END
WHERE balance IS NOT NULL;

-- 9. Crear función para generar próximo número de factura
CREATE OR REPLACE FUNCTION generate_next_invoice_number(
    p_doc_type_id UUID,
    p_organization_id UUID
)
RETURNS TEXT AS $$
DECLARE
    doc_type RECORD;
    next_number TEXT;
BEGIN
    -- Obtener información del tipo de documento e incrementar secuencia
    SELECT * INTO doc_type
    FROM document_types 
    WHERE id = p_doc_type_id AND organization_id = p_organization_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de documento no encontrado';
    END IF;
    
    -- Generar el próximo número
    next_number := doc_type.prefix || LPAD(doc_type.sequence_next_value::TEXT, 10, '0');
    
    -- Actualizar la secuencia para el próximo uso
    UPDATE document_types 
    SET sequence_next_value = sequence_next_value + 1
    WHERE id = p_doc_type_id;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Mensaje de confirmación
SELECT 'Migración aplicada exitosamente. El sistema de pagos ahora actualizará automáticamente el balance de las facturas.' as mensaje;