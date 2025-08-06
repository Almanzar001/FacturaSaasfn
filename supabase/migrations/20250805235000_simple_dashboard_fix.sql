-- Función simplificada para estadísticas del dashboard que funciona con las tablas existentes

-- Esta función calcula estadísticas básicas sin depender de las nuevas funciones
CREATE OR REPLACE FUNCTION public.get_simple_dashboard_stats(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_payments_revenue numeric := 0;
  total_general_income numeric := 0;
  total_revenue numeric := 0;
  total_expenses numeric := 0;
  total_profit numeric := 0;
  total_clients integer := 0;
  total_invoices integer := 0;
  total_quotes integer := 0;
  total_payments_count integer := 0;
  total_income_count integer := 0;
  
  -- Para el mes actual
  current_month_start date := date_trunc('month', CURRENT_DATE)::date;
  current_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
BEGIN
  -- Get total clients
  SELECT COUNT(*) INTO total_clients
  FROM public.clients
  WHERE organization_id = org_id;
  
  -- Get total invoices (este mes)
  SELECT COUNT(*) INTO total_invoices
  FROM public.invoices
  WHERE organization_id = org_id 
  AND DATE(created_at) >= current_month_start 
  AND DATE(created_at) <= current_month_end;
  
  -- Get total quotes (este mes)
  SELECT COUNT(*) INTO total_quotes
  FROM public.quotes
  WHERE organization_id = org_id
  AND DATE(created_at) >= current_month_start 
  AND DATE(created_at) <= current_month_end;
  
  -- Get payments revenue (este mes)
  SELECT COALESCE(SUM(amount), 0) INTO total_payments_revenue,
         COUNT(*) INTO total_payments_count
  FROM public.payments
  WHERE organization_id = org_id 
  AND DATE(payment_date) >= current_month_start 
  AND DATE(payment_date) <= current_month_end;
  
  -- Get general income (este mes) - solo si la tabla existe
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_general_income,
           COUNT(*) INTO total_income_count
    FROM public.general_income
    WHERE organization_id = org_id
    AND income_date >= current_month_start 
    AND income_date <= current_month_end;
  EXCEPTION WHEN undefined_table THEN
    total_general_income := 0;
    total_income_count := 0;
  END;
  
  -- Total revenue
  total_revenue := total_payments_revenue + total_general_income;
  
  -- Get expenses (este mes)
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses
  FROM public.expenses
  WHERE organization_id = org_id
  AND DATE(expense_date) >= current_month_start 
  AND DATE(expense_date) <= current_month_end;
  
  -- Calculate profit
  total_profit := total_revenue - total_expenses;
  
  RETURN jsonb_build_object(
    'totalRevenue', total_revenue,
    'totalPaymentsRevenue', total_payments_revenue,
    'totalGeneralIncome', total_general_income,
    'totalExpenses', total_expenses,
    'totalProfit', total_profit,
    'totalClients', total_clients,
    'totalInvoices', total_invoices,
    'totalQuotes', total_quotes,
    'totalPaymentsCount', total_payments_count,
    'totalIncomeCount', total_income_count,
    'revenueTrend', 0,
    'paymentsTrend', 0,
    'incomeTrend', 0,
    'expensesTrend', 0,
    'profitTrend', 0,
    'clientsTrend', 0,
    'invoicesTrend', 0,
    'quotesTrend', 0,
    'activities', '[]'::jsonb
  );
END;
$$;

-- Comentario de confirmación
SELECT 'Función simple de dashboard creada para diagnóstico.' as mensaje;