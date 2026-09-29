CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    role VARCHAR(16) NOT NULL CHECK (role IN ('personal', 'business')),
    name VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(24),
    location VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_email_lower_uq ON profiles (lower(email));

CREATE TABLE businesses (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    business_name VARCHAR(80) NOT NULL,
    plan_id VARCHAR(24) NOT NULL DEFAULT 'starter' CHECK (plan_id IN ('starter', 'studio')),
    membership_status VARCHAR(24) NOT NULL DEFAULT 'preview' CHECK (membership_status IN ('preview', 'pending', 'active', 'past_due', 'cancelled')),
    provider_customer_id VARCHAR(160),
    provider_subscription_id VARCHAR(160),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE garments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    seed_key VARCHAR(48) UNIQUE,
    owner_type VARCHAR(16) NOT NULL CHECK (owner_type IN ('personal', 'business', 'sample')),
    owner_name VARCHAR(100) NOT NULL,
    name VARCHAR(80) NOT NULL,
    designer VARCHAR(60),
    category VARCHAR(48) NOT NULL,
    condition VARCHAR(24) NOT NULL,
    description VARCHAR(500),
    rental_price NUMERIC(12,2) NOT NULL CHECK (rental_price > 0),
    retail_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (retail_value >= 0),
    default_days SMALLINT NOT NULL DEFAULT 3 CHECK (default_days BETWEEN 1 AND 30),
    size VARCHAR(20) NOT NULL,
    fit_match VARCHAR(100),
    location VARCHAR(80) NOT NULL,
    care_instructions VARCHAR(500),
    badge_color VARCHAR(24),
    image_path TEXT,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX garments_active_created_idx ON garments (active, created_at DESC);
CREATE INDEX garments_owner_idx ON garments (owner_id, created_at DESC);
CREATE INDEX garments_category_size_idx ON garments (category, size);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    owner_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    customer_name_snapshot VARCHAR(100) NOT NULL,
    garment_name_snapshot VARCHAR(80) NOT NULL,
    garment_image_snapshot TEXT,
    owner_name_snapshot VARCHAR(100) NOT NULL,
    owner_type_snapshot VARCHAR(16) NOT NULL CHECK (owner_type_snapshot IN ('personal', 'business', 'sample')),
    rental_price_snapshot NUMERIC(12,2) NOT NULL CHECK (rental_price_snapshot > 0),
    default_days_snapshot SMALLINT NOT NULL CHECK (default_days_snapshot BETWEEN 1 AND 30),
    rental_days SMALLINT NOT NULL CHECK (rental_days BETWEEN 1 AND 30),
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    fulfilment VARCHAR(16) NOT NULL DEFAULT 'pickup' CHECK (fulfilment IN ('pickup', 'delivery')),
    rental_care BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'in_use', 'return_pending', 'completed', 'declined', 'cancelled')),
    commission_rate NUMERIC(6,5) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 1),
    commission_amount NUMERIC(12,2),
    owner_payout NUMERIC(12,2),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (return_date >= pickup_date),
    CHECK (customer_id <> owner_id)
);
ALTER TABLE bookings ADD CONSTRAINT bookings_no_open_overlap
    EXCLUDE USING gist (
        garment_id WITH =,
        daterange(pickup_date, return_date, '[]') WITH &&
    ) WHERE (status IN ('requested', 'confirmed', 'in_use', 'return_pending'));
CREATE INDEX bookings_customer_idx ON bookings (customer_id, requested_at DESC);
CREATE INDEX bookings_owner_idx ON bookings (owner_id, requested_at DESC);

CREATE TABLE booking_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name_snapshot VARCHAR(100) NOT NULL,
    actor_role_snapshot VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, created_at);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    customer_name_snapshot VARCHAR(100) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    fit VARCHAR(48),
    condition VARCHAR(48),
    comment VARCHAR(600),
    visibility VARCHAR(16) NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden', 'flagged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_garment_created_idx ON reviews (garment_id, created_at DESC);

CREATE TABLE commission_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    owner_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    commission_rate NUMERIC(6,5) NOT NULL CHECK (commission_rate BETWEEN 0 AND 1),
    commission_amount NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
    owner_net_amount NUMERIC(12,2) NOT NULL CHECK (owner_net_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated', 'payable', 'paid', 'refunded', 'reversed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE membership_webhook_events (
    provider_event_id VARCHAR(200) PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL
);

CREATE TABLE saved_garments (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, garment_id)
);
