ALTER TABLE garments
    ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 1 CHECK (stock_quantity BETWEEN 1 AND 10000);

ALTER TABLE bookings DROP CONSTRAINT bookings_no_open_overlap;
