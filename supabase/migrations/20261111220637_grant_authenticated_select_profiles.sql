-- Allow signed-in users to read profile rows subject to the existing RLS policy.
-- Anonymous visitors remain without SELECT access.
GRANT SELECT ON TABLE public.profiles TO authenticated;
