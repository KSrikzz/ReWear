ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_garments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE profiles, businesses, garments, bookings, booking_events,
    reviews, commission_ledger, membership_webhook_events, saved_garments
FROM anon, authenticated;
