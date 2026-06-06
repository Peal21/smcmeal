
INSERT INTO admin_portal_credentials (id, password_hash, updated_at)
VALUES (1, crypt('12345678', gen_salt('bf')), now())
ON CONFLICT (id) DO UPDATE SET password_hash = crypt('12345678', gen_salt('bf')), updated_at = now();
