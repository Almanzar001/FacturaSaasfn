-- Add dashboard stats function for new organizations
-- This function provides basic stats for the dashboard

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_revenue numeric := 0;
  total_expenses numeric := 0;
  total_profit numeric := 0;
  total_clients integer := 0;
  total_invoices integer := 0;
  total_quotes integer := 0;
  activities jsonb := '[]'::jsonb;
BEGIN
  -- Get total clients
  SELECT COUNT(*) INTO total_clients
  FROM public.clients
  WHERE organization_id = org_id;
  
  -- Get total invoices (if table exists)
  BEGIN
    SELECT COUNT(*) INTO total_invoices
    FROM public.invoices
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_invoices := 0;
  END;
  
  -- Get total quotes (if table exists)
  BEGIN
    SELECT COUNT(*) INTO total_quotes
    FROM public.quotes
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_quotes := 0;
  END;
  
  -- Get revenue from invoices (if table exists)
  BEGIN
    SELECT COALESCE(SUM(total_amount), 0) INTO total_revenue
    FROM public.invoices
    WHERE organization_id = org_id AND status = 'paid';
  EXCEPTION WHEN undefined_table THEN
    total_revenue := 0;
  END;
  
  -- Get expenses (if table exists)
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM public.expenses
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_expenses := 0;
  END;
  
  -- Calculate profit
  total_profit := total_revenue - total_expenses;
  
  -- Create basic activities for new organizations
  IF total_invoices = 0 AND total_quotes = 0 AND total_clients = 0 THEN
    activities := jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'type', 'client',
        'title', 'Bienvenido a FacturaSaaS',
        'description', 'Comienza agregando tu primer cliente',
        'timestamp', now(),
        'status', 'pending'
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'type', 'invoice',
        'title', 'Configura tu organización',
        'description', 'Completa la información de tu empresa en configuraciones',
        'timestamp', now(),
        'status', 'pending'
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'totalRevenue', total_revenue,
    'totalExpenses', total_expenses,
    'totalProfit', total_profit,
    'totalClients', total_clients,
    'totalInvoices', total_invoices,
    'totalQuotes', total_quotes,
    'activities', activities
  );
END;
$$;

-- Create basic clients table if it doesn't exist (for new organizations)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  rnc text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on clients table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for clients
DROP POLICY IF EXISTS "Users can manage clients in their organization" ON public.clients;
CREATE POLICY "Users can manage clients in their organization" ON public.clients
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);