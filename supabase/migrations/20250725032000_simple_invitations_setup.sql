-- Simple invitations setup without pgcrypto dependency
-- This migration creates all necessary tables and functions using only native PostgreSQL functions

-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('propietario', 'administrador', 'vendedor')),
  token text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- Enable RLS on invitations table
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view invitations for their organization" ON public.invitations;
DROP POLICY IF EXISTS "Admins and owners can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins and owners can update invitations" ON public.invitations;

-- RLS policies for invitations
CREATE POLICY "Users can view invitations for their organization" ON public.invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('propietario', 'administrador')
    )
  );

CREATE POLICY "Admins and owners can update invitations" ON public.invitations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('propietario', 'administrador')
    )
  );

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.invite_user_to_organization(uuid, text, text);
DROP FUNCTION IF EXISTS public.accept_invitation(text, uuid);
DROP FUNCTION IF EXISTS public.get_invitation_details(text);
DROP FUNCTION IF EXISTS public.get_team_data(uuid);

-- Function to invite user to organization (using simple UUID-based token)
CREATE OR REPLACE FUNCTION public.invite_user_to_organization(
  p_organization_id uuid,
  p_email text,
  p_role text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invitation_token text;
  current_user_role text;
BEGIN
  -- Check if current user has permission to invite (must be owner or admin)
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid() AND organization_id = p_organization_id;
  
  IF current_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found in organization';
  END IF;
  
  IF current_user_role NOT IN ('propietario', 'administrador') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite users';
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE organization_id = p_organization_id 
    AND id IN (SELECT id FROM auth.users WHERE email = p_email)
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;
  
  -- Check if there's already a pending invitation
  IF EXISTS (
    SELECT 1 FROM public.invitations 
    WHERE organization_id = p_organization_id 
    AND email = p_email 
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'There is already a pending invitation for this email';
  END IF;
  
  -- Generate a unique token using UUID (no pgcrypto needed)
  invitation_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  
  -- Insert the invitation
  INSERT INTO public.invitations (
    organization_id,
    email,
    role,
    token,
    status,
    invited_by,
    created_at,
    updated_at
  ) VALUES (
    p_organization_id,
    p_email,
    p_role,
    invitation_token,
    'pending',
    auth.uid(),
    now(),
    now()
  );
  
  RETURN invitation_token;
END;
$$;

-- Function to get invitation details by token
CREATE OR REPLACE FUNCTION public.get_invitation_details(p_token text)
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  organization_id uuid,
  organization_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.role,
    i.status,
    i.organization_id,
    o.name as organization_name,
    i.created_at
  FROM public.invitations i
  JOIN public.organizations o ON i.organization_id = o.id
  WHERE i.token = p_token;
END;
$$;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invitation_record record;
BEGIN
  -- Get the invitation details
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE token = p_token AND status = 'pending';
  
  IF invitation_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;
  
  -- Verify the user email matches the invitation
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id AND email = invitation_record.email
  ) THEN
    RAISE EXCEPTION 'User email does not match invitation';
  END IF;
  
  -- Update the user's profile with the organization and role from invitation
  UPDATE public.profiles
  SET 
    organization_id = invitation_record.organization_id,
    role = invitation_record.role,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET 
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE id = invitation_record.id;
  
  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to accept invitation';
  END IF;
END;
$$;

-- Function to get team data (members and invitations)
CREATE OR REPLACE FUNCTION public.get_team_data(p_organization_id uuid)
RETURNS TABLE(
  members jsonb,
  invitations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  members_data jsonb;
  invitations_data jsonb;
BEGIN
  -- Get team members
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', u.email,
      'role', p.role
    )
  ) INTO members_data
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.organization_id = p_organization_id;
  
  -- Get pending invitations
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'email', i.email,
      'role', i.role,
      'status', i.status,
      'created_at', i.created_at
    )
  ) INTO invitations_data
  FROM public.invitations i
  WHERE i.organization_id = p_organization_id AND i.status = 'pending';
  
  RETURN QUERY SELECT 
    COALESCE(members_data, '[]'::jsonb) as members,
    COALESCE(invitations_data, '[]'::jsonb) as invitations;
END;
$$;

-- Update the handle_new_user function to work with the new setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  pending_invitation record;
BEGIN
  -- Check if this user has a pending invitation
  SELECT * INTO pending_invitation
  FROM public.invitations 
  WHERE email = new.email 
  AND status = 'pending'
  LIMIT 1;
  
  -- If user has a pending invitation, don't create a new organization
  -- The accept_invitation function will handle adding them to the existing organization
  IF pending_invitation.id IS NOT NULL THEN
    -- Just create the profile without organization_id (will be set when invitation is accepted)
    INSERT INTO public.profiles (id, full_name, onboarding_completed, role)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', false, 'vendedor');
    
    RETURN new;
  END IF;
  
  -- If no pending invitation, create a new organization (normal registration flow)
  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario') || '''s Organization', new.id)
  RETURNING id INTO new_org_id;

  -- Insert profile for organization owner
  INSERT INTO public.profiles (id, organization_id, full_name, onboarding_completed, role)
  VALUES (new.id, new_org_id, new.raw_user_meta_data->>'full_name', false, 'propietario');
  
  RETURN new;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();