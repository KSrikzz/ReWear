-- Creates clearly labelled dashboard demo data after the two demo accounts have
-- been registered and signed in once through the ReWear app.
-- Demo account names to use during registration:
--   Personal: Maya Demo
--   Business contact: Rohan Demo; business name: ReWear Demo Studio
-- Safe to run again; demo records are keyed by stable UUIDs / seed keys.

BEGIN;

DO $$
BEGIN
    IF (SELECT count(*) FROM profiles WHERE role = 'personal' AND id = 'd0000000-0000-4000-8000-000000000002') <> 1 THEN
        RAISE EXCEPTION 'Create and sign in once with the personal demo account named Maya Demo, then rerun this script.';
    END IF;
    IF (SELECT count(*) FROM profiles WHERE role = 'business' AND id = 'd0000000-0000-4000-8000-000000000003') <> 1 THEN
        RAISE EXCEPTION 'Create and sign in once with the business demo account contact named Rohan Demo, then rerun this script.';
    END IF;
END $$;

INSERT INTO businesses (profile_id, business_name, plan_id, membership_status, about)
SELECT id, 'ReWear Demo Studio', 'silver', 'preview',
       'A sample Chennai occasionwear collection for trying the business dashboard.'
FROM profiles WHERE role = 'business' AND id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (profile_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    plan_id = EXCLUDED.plan_id,
    membership_status = EXCLUDED.membership_status,
    about = EXCLUDED.about,
    updated_at = now();

INSERT INTO profiles (id, role, name, email, location)
VALUES ('d0000000-0000-4000-8000-000000000003', 'personal', 'Nila Sample Renter',
        'nila.sample.renter@rewear.invalid', 'Mylapore, Chennai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO garments (id, owner_id, seed_key, owner_type, owner_name, name, designer, category, condition,
    description, rental_price, retail_value, default_days, size, fit_match, location, care_instructions,
    badge_color, image_url, active)
SELECT 'd1000000-0000-4000-8000-000000000001', p.id, 'demo-business-lehenga', 'business',
    'ReWear Demo Studio', 'Ivory Embellished Pearl Lehenga', 'Tarun Tahiliani Archival', 'Lehengas',
    'Very good', 'Demo piece with a detailed rental history and customer review.', 4000, 35000, 3, 'M',
    'Bust 34â€“36 / Waist 28â€“30', 'T. Nagar, Chennai', 'Dry clean only; return in the garment bag.', 'gold',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDqTh9sth4YU3o2lXqwPkT8xuHP2ritLpxJ_xsnS0QMpHI2MVSykUc38qryS2vWARzaJ5Rhc97T8kX0O5r7FUnO5BG2jxPHHVe8gFyMvwhvKNo5rgspD9EJ9kEEXUUTdJCQxekJM_zGyU9WlLhPHSSwaUiYWVmlj6wSwqAkBnEvsVSs_LGNemNgBvz4xn3zSSG-V3WZsBeRDqlEPlLIl52Hh1rw4NUv-0D_eSdQsMMS3bd5BgFuc7g', true
FROM profiles p WHERE p.role = 'business' AND p.id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (seed_key) DO UPDATE SET owner_id = EXCLUDED.owner_id, owner_type = EXCLUDED.owner_type,
    owner_name = EXCLUDED.owner_name, name = EXCLUDED.name, designer = EXCLUDED.designer,
    category = EXCLUDED.category, condition = EXCLUDED.condition, description = EXCLUDED.description,
    rental_price = EXCLUDED.rental_price, retail_value = EXCLUDED.retail_value, default_days = EXCLUDED.default_days,
    size = EXCLUDED.size, fit_match = EXCLUDED.fit_match, location = EXCLUDED.location,
    care_instructions = EXCLUDED.care_instructions, badge_color = EXCLUDED.badge_color,
    image_url = EXCLUDED.image_url, active = true, updated_at = now();

INSERT INTO garments (id, owner_id, seed_key, owner_type, owner_name, name, designer, category, condition,
    description, rental_price, retail_value, default_days, size, fit_match, location, care_instructions,
    badge_color, image_url, active)
SELECT 'd1000000-0000-4000-8000-000000000002', p.id, 'demo-business-saree', 'business',
    'ReWear Demo Studio', 'Emerald Silk Banarasi Saree', 'Nalli Heritage Handloom', 'Sarees',
    'Excellent', 'A second demo listing used to show the review prompt and incoming requests.', 1200, 26500, 3,
    'Free', 'Includes stitched blouse (36)', 'Mylapore, Chennai', 'Dry clean only.', 'secondary',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBM1gcW9qAnlPdlxt_wNNHPGyuD6BO6DY5khgNawwBA3vnpfFOMRyc-uz6k5z0cS5wkJacwE_uqq5ZGoJLv2lkKAeDtCl-jVYJSnOVou-3UiFZ6sF6Ai1dKu8Wi1GC_lt2Pq3fFMExno6Vg-GglIssvQqiebdinmZyyMAM1gS9IwT1mCR15kWf5bRbUvvSudYH2tx8vTTjoQ7vhWATVAqHgeQNPF3WSk1FLTQkw1fm0chtT6AzUKlM', true
FROM profiles p WHERE p.role = 'business' AND p.id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (seed_key) DO UPDATE SET owner_id = EXCLUDED.owner_id, owner_type = EXCLUDED.owner_type,
    owner_name = EXCLUDED.owner_name, name = EXCLUDED.name, designer = EXCLUDED.designer,
    category = EXCLUDED.category, condition = EXCLUDED.condition, description = EXCLUDED.description,
    rental_price = EXCLUDED.rental_price, retail_value = EXCLUDED.retail_value, default_days = EXCLUDED.default_days,
    size = EXCLUDED.size, fit_match = EXCLUDED.fit_match, location = EXCLUDED.location,
    care_instructions = EXCLUDED.care_instructions, badge_color = EXCLUDED.badge_color,
    image_url = EXCLUDED.image_url, active = true, updated_at = now();

INSERT INTO garments (id, owner_id, seed_key, owner_type, owner_name, name, designer, category, condition,
    description, rental_price, retail_value, default_days, size, fit_match, location, care_instructions,
    badge_color, image_url, active)
SELECT 'd1000000-0000-4000-8000-000000000003', p.id, 'demo-personal-cape-gown', 'personal',
    'Maya Demo', 'Black & Gold Embroidered Cape Gown', 'Maya Demo', 'Women''s Gowns',
    'Worn Once', 'A sample personal closet listing with a pending request to review.', 699, 14500, 3, 'M',
    'Ask the provider about fit', 'Besant Nagar, Chennai', 'Dry clean only.', 'secondary',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAt8uJEqp-nCoir658sUy3DmCD4dFUji5ZBI-sMXGtFcsv1AzK_GpnPM8uQ3qcB1649kclH2vjbFHoEdDwl_Z20CW2spmcUCmon8Gvv8z2VFH-0YOQVedy2ZM9sY5YvBDY9vowwYzVM5Q7POwn_LUkD7NlUiU8LinB8yAS4fpDui7PXgfxyJfRRqq_Wb4-ThjryLi9w9Ak8kvXtZzxpOofJNN_FDETF0Wi4z5fbOLPjbz9iuCJ8pFQ', true
FROM profiles p WHERE p.role = 'personal' AND p.id = 'd0000000-0000-4000-8000-000000000002'
ON CONFLICT (seed_key) DO UPDATE SET owner_id = EXCLUDED.owner_id, owner_type = EXCLUDED.owner_type,
    owner_name = EXCLUDED.owner_name, name = EXCLUDED.name, designer = EXCLUDED.designer,
    category = EXCLUDED.category, condition = EXCLUDED.condition, description = EXCLUDED.description,
    rental_price = EXCLUDED.rental_price, retail_value = EXCLUDED.retail_value, default_days = EXCLUDED.default_days,
    size = EXCLUDED.size, fit_match = EXCLUDED.fit_match, location = EXCLUDED.location,
    care_instructions = EXCLUDED.care_instructions, badge_color = EXCLUDED.badge_color,
    image_url = EXCLUDED.image_url, active = true, updated_at = now();

-- Historical rentals demonstrate usage stats, payout estimates, and customer feedback.
INSERT INTO bookings (id, garment_id, customer_id, owner_id, customer_name_snapshot, garment_name_snapshot,
    garment_image_snapshot, owner_name_snapshot, owner_type_snapshot, rental_price_snapshot,
    default_days_snapshot, rental_days, pickup_date, return_date, fulfilment, status, commission_rate,
    commission_amount, owner_payout, requested_at, confirmed_at, picked_up_at, returned_at, completed_at)
SELECT 'd2000000-0000-4000-8000-000000000001', g.id, p.id, b.id, p.name, g.name, g.image_url,
    'ReWear Demo Studio', 'business', 4000, 3, 3, current_date - 31, current_date - 28,
    'pickup', 'completed', 0, 0, 4000, now() - interval '32 days', now() - interval '32 days',
    now() - interval '31 days', now() - interval '28 days', now() - interval '28 days'
FROM garments g CROSS JOIN profiles p CROSS JOIN profiles b
WHERE g.seed_key = 'demo-business-lehenga' AND p.role = 'personal' AND p.id = 'd0000000-0000-4000-8000-000000000002'
  AND b.role = 'business' AND b.id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, garment_id, customer_id, owner_id, customer_name_snapshot, garment_name_snapshot,
    garment_image_snapshot, owner_name_snapshot, owner_type_snapshot, rental_price_snapshot,
    default_days_snapshot, rental_days, pickup_date, return_date, fulfilment, status, commission_rate,
    commission_amount, owner_payout, requested_at, confirmed_at, picked_up_at, returned_at, completed_at)
SELECT 'd2000000-0000-4000-8000-000000000002', g.id, p.id, b.id, p.name, g.name, g.image_url,
    'ReWear Demo Studio', 'business', 1200, 3, 3, current_date - 44, current_date - 41,
    'delivery', 'completed', 0, 0, 1200, now() - interval '45 days', now() - interval '45 days',
    now() - interval '44 days', now() - interval '41 days', now() - interval '41 days'
FROM garments g CROSS JOIN profiles p CROSS JOIN profiles b
WHERE g.seed_key = 'demo-business-saree' AND p.role = 'personal' AND p.id = 'd0000000-0000-4000-8000-000000000002'
  AND b.role = 'business' AND b.id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (id) DO NOTHING;

-- Open requests are future-dated so they do not block real demo interactions.
INSERT INTO bookings (id, garment_id, customer_id, owner_id, customer_name_snapshot, garment_name_snapshot,
    garment_image_snapshot, owner_name_snapshot, owner_type_snapshot, rental_price_snapshot,
    default_days_snapshot, rental_days, pickup_date, return_date, fulfilment, status, commission_rate, requested_at)
SELECT 'd2000000-0000-4000-8000-000000000003', g.id, r.id, b.id, r.name, g.name, g.image_url,
    'ReWear Demo Studio', 'business', 1200, 3, 3, current_date + 14, current_date + 17,
    'pickup', 'requested', 0, now() - interval '1 day'
FROM garments g CROSS JOIN profiles r CROSS JOIN profiles b
WHERE g.seed_key = 'demo-business-saree' AND r.id = 'd0000000-0000-4000-8000-000000000003'
  AND b.role = 'business' AND b.id = 'd0000000-0000-4000-8000-000000000003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, garment_id, customer_id, owner_id, customer_name_snapshot, garment_name_snapshot,
    garment_image_snapshot, owner_name_snapshot, owner_type_snapshot, rental_price_snapshot,
    default_days_snapshot, rental_days, pickup_date, return_date, fulfilment, status, commission_rate, requested_at)
SELECT 'd2000000-0000-4000-8000-000000000004', g.id, r.id, p.id, r.name, g.name, g.image_url,
    'Maya Demo', 'personal', 699, 3, 3, current_date + 10, current_date + 13,
    'delivery', 'requested', 0.10, now() - interval '2 hours'
FROM garments g CROSS JOIN profiles r CROSS JOIN profiles p
WHERE g.seed_key = 'demo-personal-cape-gown' AND r.id = 'd0000000-0000-4000-8000-000000000003'
  AND p.role = 'personal' AND p.id = 'd0000000-0000-4000-8000-000000000002'
ON CONFLICT (id) DO NOTHING;

-- Visible product feedback on one completed rental; the other completed rental
-- remains unrated so the personal dashboard also displays the review form.
INSERT INTO reviews (id, booking_id, garment_id, customer_id, customer_name_snapshot,
    rating, fit, condition, comment, visibility, created_at)
SELECT 'd3000000-0000-4000-8000-000000000001', bk.id, bk.garment_id, bk.customer_id,
    'Maya Demo', 5, 'As expected', 'As described',
    'Beautifully finished and comfortable for a full evening. The pickup instructions were clear.',
    'visible', now() - interval '27 days'
FROM bookings bk WHERE bk.id = 'd2000000-0000-4000-8000-000000000001'
ON CONFLICT (booking_id) DO UPDATE SET rating = EXCLUDED.rating, fit = EXCLUDED.fit,
    condition = EXCLUDED.condition, comment = EXCLUDED.comment, visibility = 'visible';

INSERT INTO booking_events (booking_id, actor_id, actor_name_snapshot, actor_role_snapshot, status, created_at)
SELECT demo.booking_id, a.actor_id, demo.actor_name, demo.actor_role, demo.status, demo.created_at
FROM (VALUES
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'Maya Demo', 'personal', 'requested', now() - interval '32 days'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'Rohan Demo', 'business', 'confirmed', now() - interval '32 days' + interval '1 hour'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'Rohan Demo', 'business', 'in_use', now() - interval '31 days'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'Maya Demo', 'personal', 'return_pending', now() - interval '28 days' + interval '1 hour'),
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'Rohan Demo', 'business', 'completed', now() - interval '28 days'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'Maya Demo', 'personal', 'requested', now() - interval '45 days'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'Rohan Demo', 'business', 'confirmed', now() - interval '45 days' + interval '1 hour'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'Rohan Demo', 'business', 'in_use', now() - interval '44 days'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'Maya Demo', 'personal', 'return_pending', now() - interval '41 days' + interval '1 hour'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'Rohan Demo', 'business', 'completed', now() - interval '41 days'),
    ('d2000000-0000-4000-8000-000000000003'::uuid, 'Nila Sample Renter', 'personal', 'requested', now() - interval '1 day'),
    ('d2000000-0000-4000-8000-000000000004'::uuid, 'Nila Sample Renter', 'personal', 'requested', now() - interval '2 hours')
) AS demo(booking_id, actor_name, actor_role, status, created_at)
JOIN bookings b ON b.id = demo.booking_id
LEFT JOIN profiles p ON p.name = demo.actor_name AND p.role = demo.actor_role
CROSS JOIN LATERAL (SELECT COALESCE(p.id, b.customer_id) AS actor_id) a
WHERE NOT EXISTS (
    SELECT 1 FROM booking_events existing
    WHERE existing.booking_id = demo.booking_id AND existing.status = demo.status
);

COMMIT;
