-- Create the accounts table
CREATE TABLE public.accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    balance numeric NOT NULL DEFAULT 0,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Add account_id to payments table
ALTER TABLE public.payments
ADD COLUMN account_id uuid;

-- Add foreign key constraint to payments table
ALTER TABLE public.payments
ADD CONSTRAINT payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add account_id to invoices table
ALTER TABLE public.invoices
ADD COLUMN account_id uuid;

-- Add foreign key constraint to invoices table
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- RLS for accounts table
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for organization members" ON public.accounts
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = accounts.organization_id
  )
);

CREATE POLICY "Enable insert access for organization members" ON public.accounts
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = accounts.organization_id
  )
);

CREATE POLICY "Enable update access for organization members" ON public.accounts
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = accounts.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = accounts.organization_id
  )
);

CREATE POLICY "Enable delete access for organization members" ON public.accounts
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = accounts.organization_id
  )
);

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column on accounts table
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();