UPDATE public.master_admin_credentials
SET login_id = 'superadmin',
    password_hash = extensions.crypt('12345678', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 1;