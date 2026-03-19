
INSERT INTO public.user_roles (user_id, role)
VALUES ('28916b83-7052-4787-ac22-c9bf115d23c3', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
