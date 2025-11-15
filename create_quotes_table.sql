-- Create the missing quotes table
-- Run this in Supabase SQL Editor

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage quotes in their organization" ON quotes
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);