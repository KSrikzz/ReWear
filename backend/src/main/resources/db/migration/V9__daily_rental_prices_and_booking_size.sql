ALTER TABLE bookings ADD COLUMN selected_size VARCHAR(32);

UPDATE bookings b
SET selected_size = BTRIM(SPLIT_PART(g.size, ',', 1))
FROM garments g
WHERE g.id = b.garment_id;

ALTER TABLE bookings ALTER COLUMN selected_size SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_selected_size_nonblank CHECK (length(BTRIM(selected_size)) > 0);
