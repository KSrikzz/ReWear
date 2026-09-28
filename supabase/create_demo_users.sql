BEGIN;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, 
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  email_change_confirm_status, is_sso_user, is_anonymous,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES 
  (
    'd0000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@rewear.com',
    crypt('hackathon2026', gen_salt('bf', 10)),
    now(), '', '', '', '', '', '', '', '',
    0, false, false,
    '{"provider":"email","providers":["email"]}',
    '{"sub":"d0000000-0000-4000-8000-000000000001","email":"admin@rewear.com","email_verified":true,"phone_verified":false,"name":"System Admin","role":"admin"}',
    now(), now()
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer@rewear.com',
    crypt('hackathon2026', gen_salt('bf', 10)),
    now(), '', '', '', '', '', '', '', '',
    0, false, false,
    '{"provider":"email","providers":["email"]}',
    '{"sub":"d0000000-0000-4000-8000-000000000002","email":"customer@rewear.com","email_verified":true,"phone_verified":false,"name":"Maya Demo","role":"personal"}',
    now(), now()
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'seller@rewear.com',
    crypt('hackathon2026', gen_salt('bf', 10)),
    now(), '', '', '', '', '', '', '', '',
    0, false, false,
    '{"provider":"email","providers":["email"]}',
    '{"sub":"d0000000-0000-4000-8000-000000000003","email":"seller@rewear.com","email_verified":true,"phone_verified":false,"name":"Rohan Demo","role":"business"}',
    now(), now()
  )
ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, email = EXCLUDED.email;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES
  (
    gen_random_uuid(),
    'd0000000-0000-4000-8000-000000000001',
    '{"sub":"d0000000-0000-4000-8000-000000000001","email":"admin@rewear.com","email_verified":true,"phone_verified":false}',
    'email',
    'd0000000-0000-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    gen_random_uuid(),
    'd0000000-0000-4000-8000-000000000002',
    '{"sub":"d0000000-0000-4000-8000-000000000002","email":"customer@rewear.com","email_verified":true,"phone_verified":false}',
    'email',
    'd0000000-0000-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    gen_random_uuid(),
    'd0000000-0000-4000-8000-000000000003',
    '{"sub":"d0000000-0000-4000-8000-000000000003","email":"seller@rewear.com","email_verified":true,"phone_verified":false}',
    'email',
    'd0000000-0000-4000-8000-000000000003',
    now(), now(), now()
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role, name, email, location, created_at, updated_at)
VALUES 
  ('d0000000-0000-4000-8000-000000000001', 'admin', 'System Admin', 'admin@rewear.com', 'HQ, Chennai', now(), now()),
  ('d0000000-0000-4000-8000-000000000002', 'personal', 'Maya Demo', 'customer@rewear.com', 'Mylapore, Chennai', now(), now()),
  ('d0000000-0000-4000-8000-000000000003', 'business', 'Rohan Demo', 'seller@rewear.com', 'T. Nagar, Chennai', now(), now())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.businesses (profile_id, business_name, plan_id, membership_status, about)
VALUES 
  ('d0000000-0000-4000-8000-000000000003', 'ReWear Demo Studio', 'silver', 'active', 'A sample Chennai occasionwear collection for trying the business dashboard.')
ON CONFLICT (profile_id) DO NOTHING;

COMMIT;
