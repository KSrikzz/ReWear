ALTER TABLE bookings
    ADD COLUMN high_value_protection_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN handover_photo_paths TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN return_photo_paths TEXT[] NOT NULL DEFAULT '{}';
