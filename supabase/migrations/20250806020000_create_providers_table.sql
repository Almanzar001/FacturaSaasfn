-- Crear tabla de proveedores
CREATE TABLE public.providers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    rnc text,
    contact_person text,
    payment_terms text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT providers_pkey PRIMARY KEY (id),
    CONSTRAINT providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Habilitar RLS para la tabla de proveedores
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Política para lectura - solo miembros de la organización
CREATE POLICY "Enable read access for organization members" ON public.providers
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = providers.organization_id
  )
);

-- Política para inserción - solo miembros de la organización
CREATE POLICY "Enable insert access for organization members" ON public.providers
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = providers.organization_id
  )
);

-- Política para actualización - solo miembros de la organización
CREATE POLICY "Enable update access for organization members" ON public.providers
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = providers.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = providers.organization_id
  )
);

-- Política para eliminación - solo miembros de la organización
CREATE POLICY "Enable delete access for organization members" ON public.providers
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.organization_id = providers.organization_id
  )
);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_providers_updated_at
BEFORE UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear índices para optimizar las consultas
CREATE INDEX IF NOT EXISTS idx_providers_organization_id ON public.providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_providers_email ON public.providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_name ON public.providers(name);

-- Comentario de confirmación
SELECT 'Tabla de proveedores creada exitosamente.' as mensaje;
