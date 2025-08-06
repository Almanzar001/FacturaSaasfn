-- Crear tabla de ingresos generales
CREATE TABLE public.general_income (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    account_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    category text NOT NULL,
    income_date date NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT general_income_pkey PRIMARY KEY (id),
    CONSTRAINT general_income_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT general_income_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT
);

-- Habilitar RLS para la tabla de ingresos generales
ALTER TABLE public.general_income ENABLE ROW LEVEL SECURITY;

-- Política para lectura - solo miembros de la organización
CREATE POLICY "Enable read access for organization members" ON public.general_income
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = general_income.organization_id
  )
);

-- Política para inserción - solo miembros de la organización
CREATE POLICY "Enable insert access for organization members" ON public.general_income
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = general_income.organization_id
  )
);

-- Política para actualización - solo miembros de la organización
CREATE POLICY "Enable update access for organization members" ON public.general_income
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = general_income.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = general_income.organization_id
  )
);

-- Política para eliminación - solo miembros de la organización
CREATE POLICY "Enable delete access for organization members" ON public.general_income
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = general_income.organization_id
  )
);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_general_income_updated_at
BEFORE UPDATE ON public.general_income
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para actualizar balance de cuentas con ingresos generales
CREATE OR REPLACE FUNCTION update_account_balance_with_income()
RETURNS TRIGGER AS $$
DECLARE
    target_account_id UUID;
    total_income DECIMAL(10,2);
    total_payments DECIMAL(10,2);
    total_balance DECIMAL(10,2);
BEGIN
    -- Determinar qué account_id actualizar basado en la operación
    IF TG_OP = 'DELETE' THEN
        target_account_id := OLD.account_id;
    ELSE
        target_account_id := NEW.account_id;
    END IF;

    -- Solo proceder si hay un account_id válido
    IF target_account_id IS NOT NULL THEN
        -- Calcular total de ingresos generales para esta cuenta
        SELECT COALESCE(SUM(amount), 0) INTO total_income
        FROM general_income 
        WHERE account_id = target_account_id;

        -- Calcular total de pagos de facturas para esta cuenta
        SELECT COALESCE(SUM(amount), 0) INTO total_payments
        FROM payments 
        WHERE account_id = target_account_id;

        -- Balance total = ingresos generales + pagos de facturas
        total_balance := total_income + total_payments;

        -- Actualizar el balance de la cuenta
        UPDATE accounts 
        SET 
            balance = total_balance,
            updated_at = NOW()
        WHERE id = target_account_id;
    END IF;

    -- Retornar el registro apropiado basado en la operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para ingresos generales que actualice el balance de las cuentas
CREATE TRIGGER trigger_update_account_balance_with_income
    AFTER INSERT OR UPDATE OR DELETE ON general_income
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance_with_income();

-- Modificar la función existente de pagos para incluir ingresos generales
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    target_account_id UUID;
    total_income DECIMAL(10,2);
    total_payments DECIMAL(10,2);
    total_balance DECIMAL(10,2);
BEGIN
    -- Determinar qué account_id actualizar basado en la operación
    IF TG_OP = 'DELETE' THEN
        target_account_id := OLD.account_id;
    ELSE
        target_account_id := NEW.account_id;
    END IF;

    -- Solo proceder si hay un account_id válido
    IF target_account_id IS NOT NULL THEN
        -- Calcular total de ingresos generales para esta cuenta
        SELECT COALESCE(SUM(amount), 0) INTO total_income
        FROM general_income 
        WHERE account_id = target_account_id;

        -- Calcular total de pagos de facturas para esta cuenta
        SELECT COALESCE(SUM(amount), 0) INTO total_payments
        FROM payments 
        WHERE account_id = target_account_id;

        -- Balance total = ingresos generales + pagos de facturas
        total_balance := total_income + total_payments;

        -- Actualizar el balance de la cuenta
        UPDATE accounts 
        SET 
            balance = total_balance,
            updated_at = NOW()
        WHERE id = target_account_id;
    END IF;

    -- Retornar el registro apropiado basado en la operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Funciones CRUD para ingresos generales
CREATE OR REPLACE FUNCTION get_general_income_for_organization(org_id UUID)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    account_id UUID,
    account_name TEXT,
    description TEXT,
    amount DECIMAL(10,2),
    category TEXT,
    income_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.id,
        gi.organization_id,
        gi.account_id,
        a.name as account_name,
        gi.description,
        gi.amount,
        gi.category,
        gi.income_date,
        gi.notes,
        gi.created_at,
        gi.updated_at
    FROM general_income gi
    INNER JOIN accounts a ON gi.account_id = a.id
    WHERE gi.organization_id = org_id
    ORDER BY gi.income_date DESC, gi.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_general_income(
    org_id UUID,
    p_account_id UUID,
    p_description TEXT,
    p_amount DECIMAL(10,2),
    p_category TEXT,
    p_income_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_income_id UUID;
BEGIN
    -- Verificar que la cuenta pertenece a la organización
    IF NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE id = p_account_id AND organization_id = org_id
    ) THEN
        RAISE EXCEPTION 'La cuenta especificada no pertenece a la organización';
    END IF;

    INSERT INTO general_income (
        organization_id,
        account_id,
        description,
        amount,
        category,
        income_date,
        notes
    ) VALUES (
        org_id,
        p_account_id,
        p_description,
        p_amount,
        p_category,
        p_income_date,
        p_notes
    )
    RETURNING id INTO new_income_id;

    RETURN new_income_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_general_income(
    income_id UUID,
    p_account_id UUID,
    p_description TEXT,
    p_amount DECIMAL(10,2),
    p_category TEXT,
    p_income_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Obtener organization_id del ingreso
    SELECT organization_id INTO org_id
    FROM general_income
    WHERE id = income_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingreso no encontrado';
    END IF;

    -- Verificar que la cuenta pertenece a la organización
    IF NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE id = p_account_id AND organization_id = org_id
    ) THEN
        RAISE EXCEPTION 'La cuenta especificada no pertenece a la organización';
    END IF;

    UPDATE general_income 
    SET 
        account_id = p_account_id,
        description = p_description,
        amount = p_amount,
        category = p_category,
        income_date = p_income_date,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = income_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_general_income(income_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM general_income 
    WHERE id = income_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inicializar balances de cuentas existentes incluyendo ingresos generales
UPDATE accounts 
SET balance = COALESCE((
    SELECT SUM(amount) 
    FROM payments 
    WHERE payments.account_id = accounts.id
), 0) + COALESCE((
    SELECT SUM(amount) 
    FROM general_income 
    WHERE general_income.account_id = accounts.id
), 0);

-- Comentario de confirmación
SELECT 'Migración de ingresos generales aplicada exitosamente. Los ingresos generales ahora se integran con el sistema de cuentas.' as mensaje;