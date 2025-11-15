-- Debug quotes table schema
-- Run this in Supabase SQL Editor to see the actual table structure

-- Check if quotes table exists and its structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'quotes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if quote_items table exists and its structure  
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'quote_items' 
  AND table_schema = 'public'
ORDER BY ordinal_position;