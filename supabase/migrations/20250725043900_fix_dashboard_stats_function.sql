-- Fix dashboard stats function to show correct data
-- This function provides accurate stats for the dashboard including all payments

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
  active_clients integer := 0;
  total_invoices integer := 0;
  total_quotes integer := 0;
  activities jsonb := '[]'::jsonb;
  recent_activities jsonb := '[]'::jsonb;
BEGIN
  -- Get total clients
  SELECT COUNT(*) INTO total_clients
  FROM public.clients
  WHERE organization_id = org_id;
  
  -- Get active clients (clients with invoices in the last 6 months)
  BEGIN
    SELECT COUNT(DISTINCT c.id) INTO active_clients
    FROM public.clients c
    INNER JOIN public.invoices i ON c.id = i.client_id
    WHERE c.organization_id = org_id 
    AND i.created_at >= NOW() - INTERVAL '6 months';
  EXCEPTION WHEN undefined_table THEN
    active_clients := total_clients;
  END;
  
  -- If no active clients from invoices, use total clients
  IF active_clients = 0 THEN
    active_clients := total_clients;
  END IF;
  
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
  
  -- Get revenue from ALL payments (not just paid invoices)
  -- This includes partial payments and all payment types
  BEGIN
    SELECT COALESCE(SUM(p.amount), 0) INTO total_revenue
    FROM public.payments p
    WHERE p.organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    -- Fallback to invoice totals if payments table doesn't exist
    BEGIN
      SELECT COALESCE(SUM(total), 0) INTO total_revenue
      FROM public.invoices
      WHERE organization_id = org_id AND status IN ('paid', 'partially_paid');
    EXCEPTION WHEN undefined_table THEN
      total_revenue := 0;
    END;
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
  
  -- Get recent activities from multiple sources
  BEGIN
    WITH recent_invoices AS (
      SELECT 
        i.id,
        'invoice' as type,
        'Nueva factura: ' || i.invoice_number as title,
        'Factura para ' || c.name as description,
        i.total as amount,
        i.created_at as timestamp,
        CASE 
          WHEN i.status = 'paid' THEN 'success'
          WHEN i.status = 'partially_paid' THEN 'warning'
          ELSE 'pending'
        END as status
      FROM public.invoices i
      JOIN public.clients c ON i.client_id = c.id
      WHERE i.organization_id = org_id
      ORDER BY i.created_at DESC
      LIMIT 3
    ),
    recent_payments AS (
      SELECT 
        p.id,
        'invoice' as type,
        'Pago recibido' as title,
        'Pago de ' || c.name || ' por ' || p.amount::text as description,
        p.amount,
        p.created_at as timestamp,
        'success' as status
      FROM public.payments p
      JOIN public.clients c ON p.client_id = c.id
      WHERE p.organization_id = org_id
      ORDER BY p.created_at DESC
      LIMIT 3
    ),
    recent_clients AS (
      SELECT 
        c.id,
        'client' as type,
        'Nuevo cliente: ' || c.name as title,
        'Cliente agregado al sistema' as description,
        NULL::numeric as amount,
        c.created_at as timestamp,
        'success' as status
      FROM public.clients c
      WHERE c.organization_id = org_id
      ORDER BY c.created_at DESC
      LIMIT 2
    ),
    recent_expenses AS (
      SELECT 
        e.id,
        'expense' as type,
        'Nuevo gasto: ' || e.category as title,
        e.description,
        e.amount,
        e.created_at as timestamp,
        'warning' as status
      FROM public.expenses e
      WHERE e.organization_id = org_id
      ORDER BY e.created_at DESC
      LIMIT 2
    ),
    all_activities AS (
      SELECT * FROM recent_invoices
      UNION ALL
      SELECT * FROM recent_payments
      UNION ALL
      SELECT * FROM recent_clients
      UNION ALL
      SELECT * FROM recent_expenses
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', type,
        'title', title,
        'description', description,
        'amount', amount,
        'timestamp', timestamp,
        'status', status
      ) ORDER BY timestamp DESC
    ) INTO recent_activities
    FROM (
      SELECT * FROM all_activities
      ORDER BY timestamp DESC
      LIMIT 8
    ) ordered_activities;
    
  EXCEPTION WHEN undefined_table THEN
    -- If tables don't exist, create welcome activities
    recent_activities := jsonb_build_array(
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
  END;
  
  -- If no activities found, create default ones
  IF recent_activities IS NULL OR jsonb_array_length(recent_activities) = 0 THEN
    recent_activities := jsonb_build_array(
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
    'totalClients', active_clients, -- Use active clients instead of total
    'totalInvoices', total_invoices,
    'totalQuotes', total_quotes,
    'activities', recent_activities
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;