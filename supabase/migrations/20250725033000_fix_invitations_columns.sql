-- Fix missing columns in invitations table
-- This migration adds missing columns to the existing invitations table

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add invited_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invitations' AND column_name = 'invited_by') THEN
        ALTER TABLE public.invitations ADD COLUMN invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add accepted_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invitations' AND column_name = 'accepted_at') THEN
        ALTER TABLE public.invitations ADD COLUMN accepted_at timestamptz;
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invitations' AND column_name = 'created_at') THEN
        ALTER TABLE public.invitations ADD COLUMN created_at timestamptz DEFAULT now() NOT NULL;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invitations' AND column_name = 'updated_at') THEN
        ALTER TABLE public.invitations ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;
    END IF;
END $$;

-- Update the invite_user_to_organization function to handle missing columns gracefully
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
  has_invited_by_column boolean;
  has_timestamps boolean;
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
  
  -- Check if optional columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'invited_by'
  ) INTO has_invited_by_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'created_at'
  ) INTO has_timestamps;
  
  -- Insert the invitation with conditional columns
  IF has_invited_by_column AND has_timestamps THEN
    INSERT INTO public.invitations (
      organization_id, email, role, token, status, invited_by, created_at, updated_at
    ) VALUES (
      p_organization_id, p_email, p_role, invitation_token, 'pending', 
      auth.uid(), now(), now()
    );
  ELSIF has_timestamps THEN
    INSERT INTO public.invitations (
      organization_id, email, role, token, status, created_at, updated_at
    ) VALUES (
      p_organization_id, p_email, p_role, invitation_token, 'pending', 
      now(), now()
    );
  ELSE
    INSERT INTO public.invitations (
      organization_id, email, role, token, status
    ) VALUES (
      p_organization_id, p_email, p_role, invitation_token, 'pending'
    );
  END IF;
  
  RETURN invitation_token;
END;
$$;

-- Also update accept_invitation function to handle missing columns
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invitation_record record;
  has_timestamps boolean;
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
  
  -- Check if timestamp columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'accepted_at'
  ) INTO has_timestamps;
  
  -- Mark invitation as accepted with conditional columns
  IF has_timestamps THEN
    UPDATE public.invitations
    SET 
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE id = invitation_record.id;
  ELSE
    UPDATE public.invitations
    SET status = 'accepted'
    WHERE id = invitation_record.id;
  END IF;
  
  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to accept invitation';
  END IF;
END;
$$;