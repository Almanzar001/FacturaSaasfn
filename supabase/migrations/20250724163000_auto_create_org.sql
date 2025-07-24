-- Drop existing trigger and function if they exist to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Function to create a new organization for a new user and set them as owner
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Create a new organization using the user's full name from metadata
  insert into public.organizations (name, owner_id)
  values (new.raw_user_meta_data->>'full_name' || '''s Organization', new.id)
  returning id into new_org_id;

  -- Insert a new profile for the user, linking them to the new organization.
  -- Set them as the owner and onboarding is NOT marked as completed here; the application will handle that.
  insert into public.profiles (id, organization_id, full_name, onboarding_completed, role)
  values (new.id, new_org_id, new.raw_user_meta_data->>'full_name', false, 'propietario');
  
  return new;
end;
$$;

-- Trigger to call the function after a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();