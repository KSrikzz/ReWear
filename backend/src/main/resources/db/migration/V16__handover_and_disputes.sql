
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('requested', 'approved', 'confirmed', 'handover_pending', 'in_use', 'return_pending', 'completed', 'declined', 'cancelled', 'disputed'));

