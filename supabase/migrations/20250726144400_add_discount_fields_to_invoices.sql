-- Add discount fields to invoices table
ALTER TABLE invoices 
ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT NULL,
ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN invoices.discount_percentage IS 'Discount percentage applied to the invoice (0-100)';
COMMENT ON COLUMN invoices.discount_amount IS 'Calculated discount amount in currency';