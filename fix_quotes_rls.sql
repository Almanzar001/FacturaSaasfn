-- Fix RLS policies for quotes and quote_items tables
-- Run this in your Supabase SQL editor

-- Enable RLS on quotes table
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- RLS policy for quotes
CREATE POLICY "Users can manage quotes in their organization" ON quotes
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Enable RLS on quote_items table  
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- RLS policy for quote_items
CREATE POLICY "Users can manage quote_items in their organization" ON quote_items
  FOR ALL USING (
    quote_id IN (
      SELECT id FROM quotes WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );