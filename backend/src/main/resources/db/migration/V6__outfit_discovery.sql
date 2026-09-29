ALTER TABLE garments
    ADD COLUMN style_tag VARCHAR(32),
    ADD COLUMN colour_tag VARCHAR(32),
    ADD COLUMN occasions TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN pickup_available BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN delivery_postcodes TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN public_latitude NUMERIC(5, 2),
    ADD COLUMN public_longitude NUMERIC(6, 2),
    ADD COLUMN height_cm NUMERIC(6, 2),
    ADD COLUMN chest_cm NUMERIC(6, 2),
    ADD COLUMN waist_cm NUMERIC(6, 2),
    ADD COLUMN hip_cm NUMERIC(6, 2),
    ADD COLUMN shoulder_cm NUMERIC(6, 2),
    ADD COLUMN inseam_cm NUMERIC(6, 2),
    ADD COLUMN under_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN retired_at TIMESTAMPTZ;

ALTER TABLE garments
    ADD CONSTRAINT garments_public_location_pair CHECK (
        (public_latitude IS NULL AND public_longitude IS NULL)
        OR (public_latitude BETWEEN -90 AND 90 AND public_longitude BETWEEN -180 AND 180)
    ),
    ADD CONSTRAINT garments_measurements_nonnegative CHECK (
        (height_cm IS NULL OR height_cm > 0)
        AND (chest_cm IS NULL OR chest_cm > 0)
        AND (waist_cm IS NULL OR waist_cm > 0)
        AND (hip_cm IS NULL OR hip_cm > 0)
        AND (shoulder_cm IS NULL OR shoulder_cm > 0)
        AND (inseam_cm IS NULL OR inseam_cm > 0)
    );

CREATE INDEX garments_discovery_idx ON garments (active, category, rental_price, created_at DESC)
    WHERE retired_at IS NULL AND under_maintenance = FALSE;
CREATE INDEX bookings_open_dates_garment_idx ON bookings (garment_id, pickup_date, return_date)
    WHERE status IN ('requested', 'confirmed', 'in_use', 'return_pending');

CREATE TABLE recommendation_preferences (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    preferred_categories TEXT[] NOT NULL DEFAULT '{}',
    preferred_styles TEXT[] NOT NULL DEFAULT '{}',
    preferred_colours TEXT[] NOT NULL DEFAULT '{}',
    preferred_size VARCHAR(64),
    budget_min NUMERIC(12, 2),
    budget_max NUMERIC(12, 2),
    preferred_area VARCHAR(80),
    preferred_postcode VARCHAR(12),
    fulfilment VARCHAR(16) CHECK (fulfilment IN ('pickup', 'delivery')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (budget_min IS NULL OR budget_min >= 0),
    CHECK (budget_max IS NULL OR budget_max > 0),
    CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);
ALTER TABLE recommendation_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE recommendation_preferences FROM anon, authenticated;

CREATE TABLE pickup_hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    public_area VARCHAR(100) NOT NULL,
    city VARCHAR(80) NOT NULL,
    postcode VARCHAR(12),
    public_latitude NUMERIC(5, 2) NOT NULL CHECK (public_latitude BETWEEN -90 AND 90),
    public_longitude NUMERIC(6, 2) NOT NULL CHECK (public_longitude BETWEEN -180 AND 180),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pickup_hubs_active_city_idx ON pickup_hubs (active, city);
ALTER TABLE pickup_hubs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pickup_hubs FROM anon, authenticated;
