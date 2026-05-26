-- Run once in Supabase SQL Editor after creating the superadmin user in Authentication.
-- Replace placeholders with your superadmin user's id and email from auth.users.

-- SELECT id, email FROM auth.users WHERE email = 'admin@yourcompany.com';

SELECT public.bootstrap_superadmin_profile(
  'c89d5623-7472-4b14-8290-8514b9bec9ac'::uuid, 
  'info.digiteq00@gmail.com',
  'Super Admin'
);
