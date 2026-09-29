CREATE TABLE product_embeddings (
    product_id UUID REFERENCES garments(id) ON DELETE CASCADE,
    model_name VARCHAR(255) NOT NULL,
    embedding JSONB NOT NULL,
    searchable_text_hash TEXT,
    PRIMARY KEY (product_id, model_name)
);

CREATE TABLE user_measurement_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    measurements JSONB NOT NULL,
    height_cm DECIMAL,
    weight_kg DECIMAL,
    body_shape VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_garment_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES garments(id) ON DELETE CASCADE,
    size VARCHAR(50) NOT NULL,
    measurements JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, size)
);

CREATE TABLE fit_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES garments(id) ON DELETE CASCADE,
    size VARCHAR(50),
    fit_score DECIMAL,
    fit_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE virtual_tryon_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES garments(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    result_image_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fit_preview_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    consent_given BOOLEAN NOT NULL,
    consent_date TIMESTAMPTZ NOT NULL DEFAULT now()
);
