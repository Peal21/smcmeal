UPDATE public.master_admin_credentials
SET bound_user_id = (
  SELECT user_id FROM public.user_roles WHERE role = 'super_admin' ORDER BY id LIMIT 1
),
updated_at = now()
WHERE id = 1 AND bound_user_id IS NULL;