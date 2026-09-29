-- Lightweight in-app messaging for rental coordination
CREATE TABLE IF NOT EXISTS rental_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_messages_booking ON rental_messages(booking_id, created_at);
