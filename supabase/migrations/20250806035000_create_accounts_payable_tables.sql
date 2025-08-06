-- Crear tabla de facturas de proveedores (cuentas por pagar)
CREATE TABLE public.provider_bills (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    account_id uuid,
    bill_number text NOT NULL,
    reference_number text,
    subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax numeric NOT NULL DEFAULT 0 CHECK (tax >= 0),
    total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
    balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    due_date date NOT NULL,
    bill_date date NOT NULL DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT provider_bills_pkey PRIMARY KEY (id),
    CONSTRAINT provider_bills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT provider_bills_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
    CONSTRAINT provider_bills_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- Crear tabla de pagos a proveedores
CREATE TABLE public.provider_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    provider_bill_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    account_id uuid,
    amount numeric NOT NULL CHECK (amount > 0),
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_method text,
    reference_number text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT provider_payments_pkey PRIMARY KEY (id),
    CONSTRAINT provider_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT provider_payments_provider_bill_id_fkey FOREIGN KEY (provider_bill_id) REFERENCES public.provider_bills(id) ON DELETE CASCADE,
    CONSTRAINT provider_payments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
    CONSTRAINT provider_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- Habilitar RLS para ambas tablas
ALTER TABLE public.provider_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para provider_bills
CREATE POLICY "Users can manage provider_bills in their organization" ON public.provider_bills
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para provider_payments
CREATE POLICY "Users can manage provider_payments in their organization" ON public.provider_payments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Otorgar permisos básicos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_payments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Triggers para updated_at
CREATE TRIGGER update_provider_bills_updated_at
BEFORE UPDATE ON public.provider_bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_payments_updated_at
BEFORE UPDATE ON public.provider_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para actualizar el balance de facturas de proveedores
CREATE OR REPLACE FUNCTION update_provider_bill_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el balance de la factura cuando se agrega/elimina/modifica un pago
    IF TG_OP = 'INSERT' THEN
        UPDATE provider_bills 
        SET 
            balance = total - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM provider_payments 
                WHERE provider_bill_id = NEW.provider_bill_id
            ),
            status = CASE 
                WHEN total - (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = NEW.provider_bill_id
                ) <= 0 THEN 'paid'
                WHEN (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = NEW.provider_bill_id
                ) > 0 THEN 'partially_paid'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = NEW.provider_bill_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE provider_bills 
        SET 
            balance = total - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM provider_payments 
                WHERE provider_bill_id = NEW.provider_bill_id
            ),
            status = CASE 
                WHEN total - (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = NEW.provider_bill_id
                ) <= 0 THEN 'paid'
                WHEN (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = NEW.provider_bill_id
                ) > 0 THEN 'partially_paid'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = NEW.provider_bill_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE provider_bills 
        SET 
            balance = total - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM provider_payments 
                WHERE provider_bill_id = OLD.provider_bill_id
            ),
            status = CASE 
                WHEN total - (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = OLD.provider_bill_id
                ) <= 0 THEN 'paid'
                WHEN (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM provider_payments 
                    WHERE provider_bill_id = OLD.provider_bill_id
                ) > 0 THEN 'partially_paid'
                ELSE 'pending'
            END,
            updated_at = NOW()
        WHERE id = OLD.provider_bill_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balance automáticamente
CREATE TRIGGER update_provider_bill_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.provider_payments
FOR EACH ROW
EXECUTE FUNCTION update_provider_bill_balance();

-- Función para actualizar balance de cuentas con pagos a proveedores
CREATE OR REPLACE FUNCTION update_account_balance_with_provider_payments()
RETURNS TRIGGER AS $$
DECLARE
    target_account_id UUID;
    total_payments DECIMAL(10,2);
    total_income DECIMAL(10,2);
    total_provider_payments DECIMAL(10,2);
    total_balance DECIMAL(10,2);
BEGIN
    -- Determinar la cuenta afectada
    IF TG_OP = 'DELETE' THEN
        target_account_id := OLD.account_id;
    ELSE
        target_account_id := NEW.account_id;
    END IF;

    -- Solo proceder si hay un account_id válido
    IF target_account_id IS NOT NULL THEN
        -- Calcular total de pagos de facturas (ingresos)
        SELECT COALESCE(SUM(amount), 0) INTO total_payments
        FROM payments 
        WHERE account_id = target_account_id;

        -- Calcular total de ingresos generales
        SELECT COALESCE(SUM(amount), 0) INTO total_income
        FROM general_income 
        WHERE account_id = target_account_id;

        -- Calcular total de pagos a proveedores (egresos)
        SELECT COALESCE(SUM(amount), 0) INTO total_provider_payments
        FROM provider_payments 
        WHERE account_id = target_account_id;

        -- Balance total = ingresos - egresos
        total_balance := (total_payments + total_income) - total_provider_payments;

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

-- Trigger para actualizar balance de cuentas con pagos a proveedores
CREATE TRIGGER update_account_balance_with_provider_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.provider_payments
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_with_provider_payments();

-- Trigger para inicializar el balance de facturas de proveedores
CREATE OR REPLACE FUNCTION initialize_provider_bill_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance = NEW.total;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_provider_bill_balance_trigger
BEFORE INSERT ON public.provider_bills
FOR EACH ROW
EXECUTE FUNCTION initialize_provider_bill_balance();

-- Crear índices para optimizar las consultas
CREATE INDEX IF NOT EXISTS idx_provider_bills_organization_id ON public.provider_bills(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_bills_provider_id ON public.provider_bills(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_bills_status ON public.provider_bills(status);
CREATE INDEX IF NOT EXISTS idx_provider_bills_due_date ON public.provider_bills(due_date);

CREATE INDEX IF NOT EXISTS idx_provider_payments_organization_id ON public.provider_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_payments_provider_bill_id ON public.provider_payments(provider_bill_id);
CREATE INDEX IF NOT EXISTS idx_provider_payments_provider_id ON public.provider_payments(provider_id);

-- Comentario de confirmación
SELECT 'Tablas de cuentas por pagar creadas exitosamente.' as mensaje;
