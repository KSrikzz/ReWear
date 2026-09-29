CREATE TABLE garment_lifecycle_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    garment_id UUID NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN (
        'condition_updated', 'maintenance_started', 'maintenance_completed',
        'repair_recorded', 'retired', 'reactivated'
    )),
    previous_condition VARCHAR(24),
    next_condition VARCHAR(24),
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX garment_lifecycle_events_garment_idx ON garment_lifecycle_events (garment_id, created_at DESC);
ALTER TABLE garment_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE garment_lifecycle_events FROM anon, authenticated;
