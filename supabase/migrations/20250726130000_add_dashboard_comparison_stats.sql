-- Add dashboard comparison stats function
-- This function provides comparative stats between current and previous month

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_dashboard_comparison_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_comparison_stats(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Current month stats
  current_revenue numeric := 0;
  current_expenses numeric := 0;
  current_profit numeric := 0;
  current_clients integer := 0;
  current_invoices integer := 0;
  current_quotes integer := 0;
  
  -- Previous month stats
  prev_revenue numeric := 0;
  prev_expenses numeric := 0;
  prev_profit numeric := 0;
  prev_clients integer := 0;
  prev_invoices integer := 0;
  prev_quotes integer := 0;
  
  -- Comparison percentages
  revenue_trend numeric := 0;
  expenses_trend numeric := 0;
  profit_trend numeric := 0;
  clients_trend numeric := 0;
  invoices_trend numeric := 0;
  quotes_trend numeric := 0;
  
  -- Date ranges
  current_month_start date := date_trunc('month', CURRENT_DATE);
  current_month_end date := date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day';
  prev_month_start date := date_trunc('month', CURRENT_DATE - interval '1 month');
  prev_month_end date := date_trunc('month', CURRENT_DATE) - interval '1 day';
  
  activities jsonb := '[]'::jsonb;
BEGIN
  -- CURRENT MONTH REVENUE
  BEGIN
    SELECT COALESCE(SUM(p.amount), 0) INTO current_revenue
    FROM public.payments p
    WHERE p.organization_id = org_id
    AND p.created_at >= current_month_start
    AND p.created_at <= current_month_end;
  EXCEPTION WHEN undefined_table THEN
    -- Fallback to invoice totals if payments table doesn't exist
    BEGIN
      SELECT COALESCE(SUM(total), 0) INTO current_revenue
      FROM public.invoices
      WHERE organization_id = org_id 
      AND status IN ('paid', 'partially_paid')
      AND created_at >= current_month_start
      AND created_at <= current_month_end;
    EXCEPTION WHEN undefined_table THEN
      current_revenue := 0;
    END;
  END;
  
  -- PREVIOUS MONTH REVENUE
  BEGIN
    SELECT COALESCE(SUM(p.amount), 0) INTO prev_revenue
    FROM public.payments p
    WHERE p.organization_id = org_id
    AND p.created_at >= prev_month_start
    AND p.created_at <= prev_month_end;
  EXCEPTION WHEN undefined_table THEN
    -- Fallback to invoice totals if payments table doesn't exist
    BEGIN
      SELECT COALESCE(SUM(total), 0) INTO prev_revenue
      FROM public.invoices
      WHERE organization_id = org_id 
      AND status IN ('paid', 'partially_paid')
      AND created_at >= prev_month_start
      AND created_at <= prev_month_end;
    EXCEPTION WHEN undefined_table THEN
      prev_revenue := 0;
    END;
  END;
  
  -- CURRENT MONTH EXPENSES
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO current_expenses
    FROM public.expenses
    WHERE organization_id = org_id
    AND created_at >= current_month_start
    AND created_at <= current_month_end;
  EXCEPTION WHEN undefined_table THEN
    current_expenses := 0;
  END;
  
  -- PREVIOUS MONTH EXPENSES
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO prev_expenses
    FROM public.expenses
    WHERE organization_id = org_id
    AND created_at >= prev_month_start
    AND created_at <= prev_month_end;
  EXCEPTION WHEN undefined_table THEN
    prev_expenses := 0;
  END;
  
  -- CURRENT MONTH CLIENTS (new clients)
  SELECT COUNT(*) INTO current_clients
  FROM public.clients
  WHERE organization_id = org_id
  AND created_at >= current_month_start
  AND created_at <= current_month_end;
  
  -- PREVIOUS MONTH CLIENTS (new clients)
  SELECT COUNT(*) INTO prev_clients
  FROM public.clients
  WHERE organization_id = org_id
  AND created_at >= prev_month_start
  AND created_at <= prev_month_end;
  
  -- CURRENT MONTH INVOICES
  BEGIN
    SELECT COUNT(*) INTO current_invoices
    FROM public.invoices
    WHERE organization_id = org_id
    AND created_at >= current_month_start
    AND created_at <= current_month_end;
  EXCEPTION WHEN undefined_table THEN
    current_invoices := 0;
  END;
  
  -- PREVIOUS MONTH INVOICES
  BEGIN
    SELECT COUNT(*) INTO prev_invoices
    FROM public.invoices
    WHERE organization_id = org_id
    AND created_at >= prev_month_start
    AND created_at <= prev_month_end;
  EXCEPTION WHEN undefined_table THEN
    prev_invoices := 0;
  END;
  
  -- CURRENT MONTH QUOTES
  BEGIN
    SELECT COUNT(*) INTO current_quotes
    FROM public.quotes
    WHERE organization_id = org_id
    AND created_at >= current_month_start
    AND created_at <= current_month_end;
  EXCEPTION WHEN undefined_table THEN
    current_quotes := 0;
  END;
  
  -- PREVIOUS MONTH QUOTES
  BEGIN
    SELECT COUNT(*) INTO prev_quotes
    FROM public.quotes
    WHERE organization_id = org_id
    AND created_at >= prev_month_start
    AND created_at <= prev_month_end;
  EXCEPTION WHEN undefined_table THEN
    prev_quotes := 0;
  END;
  
  -- Calculate profits
  current_profit := current_revenue - current_expenses;
  prev_profit := prev_revenue - prev_expenses;
  
  -- Calculate percentage trends (avoid division by zero)
  IF prev_revenue > 0 THEN
    revenue_trend := ROUND(((current_revenue - prev_revenue) / prev_revenue * 100)::numeric, 1);
  ELSIF current_revenue > 0 THEN
    revenue_trend := 100; -- 100% increase from 0
  END IF;
  
  IF prev_expenses > 0 THEN
    expenses_trend := ROUND(((current_expenses - prev_expenses) / prev_expenses * 100)::numeric, 1);
  ELSIF current_expenses > 0 THEN
    expenses_trend := 100; -- 100% increase from 0
  END IF;
  
  IF prev_profit != 0 THEN
    profit_trend := ROUND(((current_profit - prev_profit) / ABS(prev_profit) * 100)::numeric, 1);
  ELSIF current_profit > 0 AND prev_profit = 0 THEN
    profit_trend := 100; -- 100% increase from 0
  ELSIF current_profit < 0 AND prev_profit = 0 THEN
    profit_trend := -100; -- 100% decrease to negative
  END IF;
  
  IF prev_clients > 0 THEN
    clients_trend := ROUND(((current_clients - prev_clients) / prev_clients::numeric * 100)::numeric, 1);
  ELSIF current_clients > 0 THEN
    clients_trend := 100; -- 100% increase from 0
  END IF;
  
  IF prev_invoices > 0 THEN
    invoices_trend := ROUND(((current_invoices - prev_invoices) / prev_invoices::numeric * 100)::numeric, 1);
  ELSIF current_invoices > 0 THEN
    invoices_trend := 100; -- 100% increase from 0
  END IF;
  
  IF prev_quotes > 0 THEN
    quotes_trend := ROUND(((current_quotes - prev_quotes) / prev_quotes::numeric * 100)::numeric, 1);
  ELSIF current_quotes > 0 THEN
    quotes_trend := 100; -- 100% increase from 0
  END IF;
  
  -- Get recent activities (reuse from existing function)
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
    ) INTO activities
    FROM (
      SELECT * FROM all_activities
      ORDER BY timestamp DESC
      LIMIT 8
    ) ordered_activities;
    
  EXCEPTION WHEN undefined_table THEN
    -- If tables don't exist, create welcome activities
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
  END;
  
  -- If no activities found, create default ones
  IF activities IS NULL OR jsonb_array_length(activities) = 0 THEN
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
    'totalRevenue', current_revenue,
    'totalExpenses', current_expenses,
    'totalProfit', current_profit,
    'totalClients', current_clients,
    'totalInvoices', current_invoices,
    'totalQuotes', current_quotes,
    'revenueTrend', revenue_trend,
    'expensesTrend', expenses_trend,
    'profitTrend', profit_trend,
    'clientsTrend', clients_trend,
    'invoicesTrend', invoices_trend,
    'quotesTrend', quotes_trend,
    'activities', activities
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_comparison_stats(uuid) TO authenticated;