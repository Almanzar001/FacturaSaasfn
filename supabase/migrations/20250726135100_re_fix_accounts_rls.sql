-- Drop existing policies and the helper function
DROP POLICY IF EXISTS "Enable read access for organization members" ON public.accounts;
DROP POLICY IF EXISTS "Enable insert access for organization members" ON public.accounts;
DROP POLICY IF EXISTS "Enable update access for organization members" ON public.accounts;
DROP POLICY IF EXISTS "Enable delete access for organization members" ON public.accounts;
DROP FUNCTION IF EXISTS public.is_org_member(uuid);

-- Function to get the organization_id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER -- Important: runs as the calling user
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;

-- Recreate policies using the new helper function
CREATE POLICY "Enable all actions for organization members" ON public.accounts
FOR ALL
TO authenticated
USING (organization_id = public.get_my_org_id())
WITH CHECK (organization_id = public.get_my_org_id());