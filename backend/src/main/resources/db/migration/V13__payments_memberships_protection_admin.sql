ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('personal', 'business', 'admin'));

ALTER TABLE businesses DROP CONSTRAINT businesses_plan_id_check;
ALTER TABLE businesses DROP CONSTRAINT businesses_membership_status_check;
UPDATE businesses SET plan_id = CASE WHEN plan_id = 'studio' THEN 'gold' ELSE 'silver' END;
UPDATE businesses SET membership_status = 'pending', current_period_end = NULL;
ALTER TABLE businesses ALTER COLUMN plan_id SET DEFAULT 'silver';
ALTER TABLE businesses ALTER COLUMN membership_status SET DEFAULT 'pending';
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_id_check CHECK (plan_id IN ('silver', 'gold'));
ALTER TABLE businesses ADD CONSTRAINT businesses_membership_status_check CHECK (membership_status IN ('pending', 'active', 'expired', 'cancelled', 'failed'));

ALTER TABLE garments ADD COLUMN deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0);

ALTER TABLE bookings
    ADD COLUMN platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
    ADD COLUMN protection_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN protection_premium NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (protection_premium >= 0),
    ADD COLUMN deposit_amount_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount_snapshot >= 0),
    ADD COLUMN total_payable NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_payable >= 0),
    ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'successful', 'failed', 'cancelled', 'refunded')),
    ADD COLUMN payment_required BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE bookings SET total_payable = rental_price_snapshot WHERE total_payable = 0;

CREATE TABLE business_membership_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id VARCHAR(16) NOT NULL CHECK (plan_id IN ('silver', 'gold')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(16) NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'failed')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    payment_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX business_membership_history_profile_idx ON business_membership_history(profile_id, created_at DESC);

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(48) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    booking_id UUID REFERENCES bookings(id) ON DELETE RESTRICT,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('RENTAL', 'MEMBERSHIP', 'PROTECTION', 'PLATFORM_FEE', 'REFUND')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(24) NOT NULL CHECK (payment_method IN ('upi', 'card', 'net_banking', 'wallet')),
    gateway VARCHAR(32) NOT NULL DEFAULT 'REWEAR_MOCK_GATEWAY',
    membership_plan VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_transactions_user_idx ON payment_transactions(user_id, created_at DESC);
CREATE INDEX payment_transactions_booking_idx ON payment_transactions(booking_id);
ALTER TABLE business_membership_history ADD CONSTRAINT business_membership_history_payment_fk
    FOREIGN KEY (payment_id) REFERENCES payment_transactions(id) ON DELETE SET NULL;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE payment_transactions FROM anon, authenticated;

ALTER TABLE business_membership_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE business_membership_history FROM anon, authenticated;

CREATE TABLE protection_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reason VARCHAR(1200) NOT NULL,
    requested_amount NUMERIC(12,2) NOT NULL CHECK (requested_amount > 0),
    approved_amount NUMERIC(12,2),
    evidence_paths TEXT[] NOT NULL DEFAULT '{}',
    owner_response VARCHAR(1000),
    admin_note VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'seller_responded', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX protection_claims_status_idx ON protection_claims(status, submitted_at DESC);
ALTER TABLE protection_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE protection_claims FROM anon, authenticated;
