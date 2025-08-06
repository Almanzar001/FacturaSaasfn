-- Agregar campo de firma digital a organizaciones

-- Agregar columna para la firma digital (imagen)
ALTER TABLE public.organizations 
ADD COLUMN digital_signature_url TEXT;

-- Agregar comentario para documentar el campo
COMMENT ON COLUMN public.organizations.digital_signature_url 
IS 'URL de la imagen de la firma digital que aparecerá en los PDFs';

-- Comentario de confirmación
SELECT 'Campo digital_signature_url agregado a la tabla organizations.' as mensaje;