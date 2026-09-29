ALTER TABLE bookings ADD COLUMN customer_postcode VARCHAR(12);
ALTER TABLE reviews ADD COLUMN image_paths TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE review_helpful_votes (
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (review_id, profile_id)
);
CREATE INDEX review_helpful_votes_profile_idx ON review_helpful_votes (profile_id, created_at DESC);
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE review_helpful_votes FROM anon, authenticated;
