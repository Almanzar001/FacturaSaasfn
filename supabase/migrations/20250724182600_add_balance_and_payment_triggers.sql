-- Add balance column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0;

-- Add missing columns that are used in the frontend but not in the database schema
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type_id UUID;

-- Add missing columns to invoice_items table
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Create function to calculate and update invoice balance
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(10,2);
    total_payments DECIMAL(10,2);
    new_balance DECIMAL(10,2);
    target_invoice_id UUID;
BEGIN
    -- Determine which invoice_id to update based on the operation
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;

    -- Get the invoice total
    SELECT total INTO invoice_total 
    FROM invoices 
    WHERE id = target_invoice_id;

    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM payments 
    WHERE invoice_id = target_invoice_id;

    -- Calculate new balance
    new_balance := invoice_total - total_payments;

    -- Update the invoice balance and status
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

    -- Return the appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payments table
DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON payments;
CREATE TRIGGER trigger_update_invoice_balance
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_balance();

-- Initialize balance for existing invoices
UPDATE invoices 
SET balance = total - COALESCE((
    SELECT SUM(amount) 
    FROM payments 
    WHERE payments.invoice_id = invoices.id
), 0)
WHERE balance IS NULL OR balance = 0;

-- Update status based on balance for existing invoices
UPDATE invoices 
SET status = CASE 
    WHEN balance <= 0 THEN 'paid'
    WHEN balance < total THEN 'partially_paid'
    ELSE status
END
WHERE balance IS NOT NULL;

-- Create function to generate next invoice number (if it doesn't exist)
CREATE OR REPLACE FUNCTION generate_next_invoice_number(
    p_doc_type_id UUID,
    p_organization_id UUID
)
RETURNS TEXT AS $$
DECLARE
    doc_type RECORD;
    next_number TEXT;
BEGIN
    -- Get document type info and increment sequence
    SELECT * INTO doc_type
    FROM document_types 
    WHERE id = p_doc_type_id AND organization_id = p_organization_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document type not found';
    END IF;
    
    -- Generate the next number
    next_number := doc_type.prefix || LPAD(doc_type.sequence_next_value::TEXT, 10, '0');
    
    -- Update the sequence for next use
    UPDATE document_types 
    SET sequence_next_value = sequence_next_value + 1
    WHERE id = p_doc_type_id;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Create document_types table if it doesn't exist
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

-- Insert default document types for existing organizations
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