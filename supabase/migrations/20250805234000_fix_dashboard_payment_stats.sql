-- Corregir función de estadísticas del dashboard para usar pagos reales en lugar de facturas "paid"

-- Actualizar la función básica de estadísticas
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_revenue numeric := 0;
  total_general_income numeric := 0;
  total_payments_revenue numeric := 0;
  total_expenses numeric := 0;
  total_profit numeric := 0;
  total_clients integer := 0;
  total_invoices integer := 0;
  total_quotes integer := 0;
  total_income_count integer := 0;
  activities jsonb := '[]'::jsonb;
BEGIN
  -- Get total clients
  SELECT COUNT(*) INTO total_clients
  FROM public.clients
  WHERE organization_id = org_id;
  
  -- Get total invoices
  BEGIN
    SELECT COUNT(*) INTO total_invoices
    FROM public.invoices
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_invoices := 0;
  END;
  
  -- Get total quotes
  BEGIN
    SELECT COUNT(*) INTO total_quotes
    FROM public.quotes
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_quotes := 0;
  END;
  
  -- Get revenue from PAYMENTS (real money received)
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_payments_revenue
    FROM public.payments
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_payments_revenue := 0;
  END;
  
  -- Get general income
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_general_income
    FROM public.general_income
    WHERE organization_id = org_id;
    
    SELECT COUNT(*) INTO total_income_count
    FROM public.general_income
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_general_income := 0;
    total_income_count := 0;
  END;
  
  -- Total revenue = payments from invoices + general income
  total_revenue := total_payments_revenue + total_general_income;
  
  -- Get expenses
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM public.expenses
    WHERE organization_id = org_id;
  EXCEPTION WHEN undefined_table THEN
    total_expenses := 0;
  END;
  
  -- Calculate profit
  total_profit := total_revenue - total_expenses;
  
  -- Build activities JSON (simplified for now)
  activities := jsonb_build_array();
  
  RETURN jsonb_build_object(
    'totalRevenue', total_revenue,
    'totalPaymentsRevenue', total_payments_revenue,
    'totalGeneralIncome', total_general_income,
    'totalExpenses', total_expenses,
    'totalProfit', total_profit,
    'totalClients', total_clients,
    'totalInvoices', total_invoices,
    'totalQuotes', total_quotes,
    'totalIncomeCount', total_income_count,
    'activities', activities
  );
END;
$$;

-- Actualizar la función de estadísticas comparativas
CREATE OR REPLACE FUNCTION public.get_dashboard_comparison_stats(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Current period stats
  total_revenue numeric := 0;
  total_general_income numeric := 0;
  total_payments_revenue numeric := 0;
  total_expenses numeric := 0;
  total_profit numeric := 0;
  total_clients integer := 0;
  total_invoices integer := 0;
  total_quotes integer := 0;
  total_income_count integer := 0;
  total_payments_count integer := 0;
  
  -- Previous period stats for comparison
  prev_revenue numeric := 0;
  prev_general_income numeric := 0;
  prev_payments_revenue numeric := 0;
  prev_expenses numeric := 0;
  prev_profit numeric := 0;
  prev_clients integer := 0;
  prev_invoices integer := 0;
  prev_quotes integer := 0;
  prev_income_count integer := 0;
  prev_payments_count integer := 0;
  
  -- Trend calculations
  revenue_trend numeric := 0;
  income_trend numeric := 0;
  payments_trend numeric := 0;
  expenses_trend numeric := 0;
  profit_trend numeric := 0;
  clients_trend numeric := 0;
  invoices_trend numeric := 0;
  quotes_trend numeric := 0;
  
  -- Date ranges
  current_period_start date := date_trunc('month', CURRENT_DATE)::date;
  current_period_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  prev_period_start date := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  prev_period_end date := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  
  activities jsonb := '[]'::jsonb;
BEGIN
  -- === CURRENT PERIOD STATS ===
  
  -- Get total clients (all time)
  SELECT COUNT(*) INTO total_clients
  FROM public.clients
  WHERE organization_id = org_id;
  
  -- Get total invoices (current month)
  BEGIN
    SELECT COUNT(*) INTO total_invoices
    FROM public.invoices
    WHERE organization_id = org_id 
    AND created_at >= current_period_start 
    AND created_at <= current_period_end;
  EXCEPTION WHEN undefined_table THEN
    total_invoices := 0;
  END;
  
  -- Get total quotes (current month)
  BEGIN
    SELECT COUNT(*) INTO total_quotes
    FROM public.quotes
    WHERE organization_id = org_id
    AND created_at >= current_period_start 
    AND created_at <= current_period_end;
  EXCEPTION WHEN undefined_table THEN
    total_quotes := 0;
  END;
  
  -- Get payments revenue (current month) - usando payment_date
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_payments_revenue
    FROM public.payments
    WHERE organization_id = org_id 
    AND payment_date >= current_period_start 
    AND payment_date <= current_period_end;
    
    SELECT COUNT(*) INTO total_payments_count
    FROM public.payments
    WHERE organization_id = org_id 
    AND payment_date >= current_period_start 
    AND payment_date <= current_period_end;
  EXCEPTION WHEN undefined_table THEN
    total_payments_revenue := 0;
    total_payments_count := 0;
  END;
  
  -- Get general income (current month)
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_general_income
    FROM public.general_income
    WHERE organization_id = org_id
    AND income_date >= current_period_start 
    AND income_date <= current_period_end;
    
    SELECT COUNT(*) INTO total_income_count
    FROM public.general_income
    WHERE organization_id = org_id
    AND income_date >= current_period_start 
    AND income_date <= current_period_end;
  EXCEPTION WHEN undefined_table THEN
    total_general_income := 0;
    total_income_count := 0;
  END;
  
  -- Total revenue = payments from invoices + general income
  total_revenue := total_payments_revenue + total_general_income;
  
  -- Get expenses (current month)
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_expenses
    FROM public.expenses
    WHERE organization_id = org_id
    AND expense_date >= current_period_start 
    AND expense_date <= current_period_end;
  EXCEPTION WHEN undefined_table THEN
    total_expenses := 0;
  END;
  
  -- Calculate profit
  total_profit := total_revenue - total_expenses;
  
  -- === PREVIOUS PERIOD STATS ===
  
  -- Previous month clients (new clients in previous month)
  SELECT COUNT(*) INTO prev_clients
  FROM public.clients
  WHERE organization_id = org_id
  AND created_at >= prev_period_start 
  AND created_at <= prev_period_end;
  
  -- Previous month invoices
  BEGIN
    SELECT COUNT(*) INTO prev_invoices
    FROM public.invoices
    WHERE organization_id = org_id
    AND created_at >= prev_period_start 
    AND created_at <= prev_period_end;
  EXCEPTION WHEN undefined_table THEN
    prev_invoices := 0;
  END;
  
  -- Previous month quotes
  BEGIN
    SELECT COUNT(*) INTO prev_quotes
    FROM public.quotes
    WHERE organization_id = org_id
    AND created_at >= prev_period_start 
    AND created_at <= prev_period_end;
  EXCEPTION WHEN undefined_table THEN
    prev_quotes := 0;
  END;
  
  -- Previous month payments revenue
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO prev_payments_revenue
    FROM public.payments
    WHERE organization_id = org_id 
    AND payment_date >= prev_period_start 
    AND payment_date <= prev_period_end;
    
    SELECT COUNT(*) INTO prev_payments_count
    FROM public.payments
    WHERE organization_id = org_id 
    AND payment_date >= prev_period_start 
    AND payment_date <= prev_period_end;
  EXCEPTION WHEN undefined_table THEN
    prev_payments_revenue := 0;
    prev_payments_count := 0;
  END;
  
  -- Previous month general income
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO prev_general_income
    FROM public.general_income
    WHERE organization_id = org_id
    AND income_date >= prev_period_start 
    AND income_date <= prev_period_end;
    
    SELECT COUNT(*) INTO prev_income_count
    FROM public.general_income
    WHERE organization_id = org_id
    AND income_date >= prev_period_start 
    AND income_date <= prev_period_end;
  EXCEPTION WHEN undefined_table THEN
    prev_general_income := 0;
    prev_income_count := 0;
  END;
  
  -- Previous total revenue
  prev_revenue := prev_payments_revenue + prev_general_income;
  
  -- Previous month expenses
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO prev_expenses
    FROM public.expenses
    WHERE organization_id = org_id
    AND expense_date >= prev_period_start 
    AND expense_date <= prev_period_end;
  EXCEPTION WHEN undefined_table THEN
    prev_expenses := 0;
  END;
  
  -- Previous profit
  prev_profit := prev_revenue - prev_expenses;
  
  -- === CALCULATE TRENDS ===
  
  -- Revenue trend
  IF prev_revenue > 0 THEN
    revenue_trend := ((total_revenue - prev_revenue) / prev_revenue) * 100;
  ELSE
    revenue_trend := CASE WHEN total_revenue > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Payments trend
  IF prev_payments_revenue > 0 THEN
    payments_trend := ((total_payments_revenue - prev_payments_revenue) / prev_payments_revenue) * 100;
  ELSE
    payments_trend := CASE WHEN total_payments_revenue > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Income trend
  IF prev_general_income > 0 THEN
    income_trend := ((total_general_income - prev_general_income) / prev_general_income) * 100;
  ELSE
    income_trend := CASE WHEN total_general_income > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Expenses trend
  IF prev_expenses > 0 THEN
    expenses_trend := ((total_expenses - prev_expenses) / prev_expenses) * 100;
  ELSE
    expenses_trend := CASE WHEN total_expenses > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Profit trend
  IF prev_profit != 0 THEN
    profit_trend := ((total_profit - prev_profit) / abs(prev_profit)) * 100;
  ELSE
    profit_trend := CASE WHEN total_profit > 0 THEN 100 WHEN total_profit < 0 THEN -100 ELSE 0 END;
  END IF;
  
  -- Clients trend (new clients this month vs last month)
  IF prev_clients > 0 THEN
    clients_trend := ((total_clients - prev_clients) / prev_clients::float) * 100;
  ELSE
    clients_trend := CASE WHEN total_clients > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Invoices trend
  IF prev_invoices > 0 THEN
    invoices_trend := ((total_invoices - prev_invoices) / prev_invoices::float) * 100;
  ELSE
    invoices_trend := CASE WHEN total_invoices > 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Quotes trend
  IF prev_quotes > 0 THEN
    quotes_trend := ((total_quotes - prev_quotes) / prev_quotes::float) * 100;
  ELSE
    quotes_trend := CASE WHEN total_quotes > 0 THEN 100 ELSE 0 END;
  END IF;
  
  RETURN jsonb_build_object(
    'totalRevenue', total_revenue,
    'totalPaymentsRevenue', total_payments_revenue,
    'totalGeneralIncome', total_general_income,
    'totalExpenses', total_expenses,
    'totalProfit', total_profit,
    'totalClients', total_clients,
    'totalInvoices', total_invoices,
    'totalQuotes', total_quotes,
    'totalIncomeCount', total_income_count,
    'totalPaymentsCount', total_payments_count,
    'revenueTrend', ROUND(revenue_trend, 2),
    'paymentsTrend', ROUND(payments_trend, 2),
    'incomeTrend', ROUND(income_trend, 2),
    'expensesTrend', ROUND(expenses_trend, 2),
    'profitTrend', ROUND(profit_trend, 2),
    'clientsTrend', ROUND(clients_trend, 2),
    'invoicesTrend', ROUND(invoices_trend, 2),
    'quotesTrend', ROUND(quotes_trend, 2),
    'activities', activities
  );
END;
$$;

-- Comentario de confirmación
SELECT 'Funciones de dashboard corregidas para usar pagos reales en lugar de facturas marcadas como pagadas.' as mensaje;