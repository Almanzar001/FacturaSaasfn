-- Corregir función de debug con ambigüedad de columnas
CREATE OR REPLACE FUNCTION debug_user_permissions()
RETURNS TABLE (
    user_id UUID,
    organization_id UUID,
    user_role TEXT,
    can_access_branches BOOLEAN,
    can_access_inventory BOOLEAN
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid(),
        p.organization_id,
        COALESCE(p.role, 'no_role'),
        EXISTS(SELECT 1 FROM branches b WHERE b.organization_id = p.organization_id LIMIT 1),
        EXISTS(SELECT 1 FROM inventory_settings s WHERE s.organization_id = p.organization_id)
    FROM profiles p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql;