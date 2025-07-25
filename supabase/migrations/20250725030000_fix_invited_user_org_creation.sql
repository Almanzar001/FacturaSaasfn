-- Fix: Prevent invited users from creating new organizations
-- This migration modifies the handle_new_user function to check if a user
-- is being created through an invitation before creating a new organization

-- Drop existing trigger and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.accept_invitation(text, uuid);
DROP FUNCTION IF EXISTS public.get_invitation_details(text);
DROP FUNCTION IF EXISTS public.invite_user_to_organization(uuid, text, text);

-- Updated function that checks for pending invitations before creating organization
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
  pending_invitation record;
begin
  -- Check if this user has a pending invitation
  select * into pending_invitation
  from public.invitations 
  where email = new.email 
  and status = 'pending'
  limit 1;
  
  -- If user has a pending invitation, don't create a new organization
  -- The accept_invitation function will handle adding them to the existing organization
  if pending_invitation.id is not null then
    -- Just create the profile without organization_id (will be set when invitation is accepted)
    insert into public.profiles (id, full_name, onboarding_completed, role)
    values (new.id, new.raw_user_meta_data->>'full_name', false, 'vendedor');
    
    return new;
  end if;
  
  -- If no pending invitation, create a new organization (normal registration flow)
  insert into public.organizations (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'full_name', 'Usuario') || '''s Organization', new.id)
  returning id into new_org_id;

  -- Insert profile for organization owner
  insert into public.profiles (id, organization_id, full_name, onboarding_completed, role)
  values (new.id, new_org_id, new.raw_user_meta_data->>'full_name', false, 'propietario');
  
  return new;
end;
$$;

-- Recreate the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also need to ensure we have the accept_invitation function
-- This function should be called when a user accepts an invitation
create or replace function public.accept_invitation(p_token text, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  invitation_record record;
begin
  -- Get the invitation details
  select * into invitation_record
  from public.invitations
  where token = p_token and status = 'pending';
  
  if invitation_record.id is null then
    raise exception 'Invalid or expired invitation token';
  end if;
  
  -- Update the user's profile with the organization and role from invitation
  update public.profiles
  set 
    organization_id = invitation_record.organization_id,
    role = invitation_record.role,
    updated_at = now()
  where id = p_user_id;
  
  -- Mark invitation as accepted
  update public.invitations
  set 
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = invitation_record.id;
  
  -- Verify the update was successful
  if not found then
    raise exception 'Failed to accept invitation';
  end if;
end;
$$;

-- Function to get invitation details by token
create or replace function public.get_invitation_details(p_token text)
returns table(
  id uuid,
  email text,
  role text,
  status text,
  organization_id uuid,
  organization_name text,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select 
    i.id,
    i.email,
    i.role,
    i.status,
    i.organization_id,
    o.name as organization_name,
    i.created_at
  from public.invitations i
  join public.organizations o on i.organization_id = o.id
  where i.token = p_token;
end;
$$;

-- Function to invite user to organization
create or replace function public.invite_user_to_organization(
  p_organization_id uuid,
  p_email text,
  p_role text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  invitation_token text;
  current_user_role text;
begin
  -- Check if current user has permission to invite (must be owner or admin)
  select role into current_user_role
  from public.profiles
  where id = auth.uid() and organization_id = p_organization_id;
  
  if current_user_role not in ('propietario', 'administrador') then
    raise exception 'Insufficient permissions to invite users';
  end if;
  
  -- Generate a unique token
  invitation_token := encode(gen_random_bytes(32), 'hex');
  
  -- Insert the invitation
  insert into public.invitations (
    organization_id,
    email,
    role,
    token,
    status,
    invited_by,
    created_at,
    updated_at
  ) values (
    p_organization_id,
    p_email,
    p_role,
    invitation_token,
    'pending',
    auth.uid(),
    now(),
    now()
  );
  
  return invitation_token;
end;
$$;