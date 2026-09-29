ALTER TABLE profiles ADD COLUMN account_status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended'));
