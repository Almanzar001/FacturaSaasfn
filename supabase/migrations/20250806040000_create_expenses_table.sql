-- Crear tabla de gastos (expenses)
CREATE TABLE public.expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    category text NOT NULL,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    receipt_url text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT expenses_pkey PRIMARY KEY (id),
    CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Política RLS para gastos
CREATE POLICY "Users can manage expenses in their organization" ON public.expenses
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Otorgar permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Trigger para updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear índices para optimizar las consultas
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- Función para crear gastos
CREATE OR REPLACE FUNCTION public.create_expense(
    org_id uuid,
    p_description text,
    p_amount numeric,
    p_category text,
    p_expense_date date,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_expense_id uuid;
BEGIN
    INSERT INTO public.expenses (
        organization_id,
        description,
        amount,
        category,
        expense_date,
        notes
    ) VALUES (
        org_id,
        p_description,
        p_amount,
        p_category,
        p_expense_date,
        p_notes
    )
    RETURNING id INTO new_expense_id;
    
    RETURN new_expense_id;
END;
$$;

-- Función para actualizar gastos
CREATE OR REPLACE FUNCTION public.update_expense(
    expense_id uuid,
    p_description text,
    p_amount numeric,
    p_category text,
    p_expense_date date,
    p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.expenses 
    SET 
        description = p_description,
        amount = p_amount,
        category = p_category,
        expense_date = p_expense_date,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = expense_id;
END;
$$;

-- Función para eliminar gastos
CREATE OR REPLACE FUNCTION public.delete_expense(expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.expenses WHERE id = expense_id;
END;
$$;

-- Función para obtener gastos de una organización
CREATE OR REPLACE FUNCTION public.get_expenses_for_organization(org_id uuid)
RETURNS TABLE (
    id uuid,
    organization_id uuid,
    description text,
    amount numeric,
    category text,
    expense_date date,
    receipt_url text,
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.organization_id,
        e.description,
        e.amount,
        e.category,
        e.expense_date,
        e.receipt_url,
        e.notes,
        e.created_at,
        e.updated_at
    FROM public.expenses e
    WHERE e.organization_id = org_id
    ORDER BY e.expense_date DESC, e.created_at DESC;
END;
$$;

-- Otorgar permisos a las funciones
GRANT EXECUTE ON FUNCTION public.create_expense(uuid, text, numeric, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_expense(uuid, text, numeric, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expenses_for_organization(uuid) TO authenticated;

-- Comentario de confirmación
SELECT 'Tabla de gastos (expenses) creada exitosamente.' as mensaje;
