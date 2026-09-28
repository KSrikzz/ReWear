# ReWear

ReWear is a circular occasionwear marketplace. The browser uses Supabase Auth for user sessions and the Spring Boot API for marketplace data and rules. Garment photos live in Supabase Storage.

## Features connected to the API

- Personal, business, and configured administrator account sign-in. Admin access is assigned from the server-side `REWEAR_ADMIN_EMAILS` allowlist.
- Personal and business wardrobes can browse and rent; each account can list clothing, manage its own rentals, and submit feedback after completed rentals.
- Saved outfits persist to the account, and the neighborhood picker narrows browsing to configured pickup areas or listing locations.
- Product pages include a digital clothing passport built from the live listing, condition, care, activity, and review records.
- Businesses can purchase configurable Silver and Gold memberships through simulated checkout.
- Booking transitions and date conflicts are enforced by the API and PostgreSQL.
- Product activity and ratings are derived from booking and review history.
- The API calculates rental totals, platform fees, deposits, protection premiums, and provider commissions. Completed rentals create commission ledger entries.
- Rental and membership payments use a simulated ReWear payment gateway. No real payment provider or money movement is connected.
- Optional Rental Protection is attached to a rental. High-value protected rentals require handover and return photos; claims go to the provider and administrator review.
- Providers set listing stock; overlapping requests reserve inventory without overselling. Date-based discovery hides listings when all units are reserved.
- AI Outfit Discovery interprets free text and an optional, consented inspiration image, checks rental-date availability, applies hard filters before scoring, and explains recommendation and fit signals. If no AI key is configured, deterministic interpretation is used.
- Owners can record condition changes, maintenance, repairs or inspections, and listing retirement. This history is private to the listing owner.
- Rental requests check the selected pickup or delivery method and coverage PIN. For delivery, the renter’s PIN is shared with the owner after the request is confirmed.
- Completed renters can attach up to three review photos. Readers can filter and sort verified reviews and vote that a review was helpful.

## Configure the local app

1. Copy `.env.example` to `.env.local` and set the Supabase project URL, publishable key, and backend URL.
2. Follow [`../backend/README.md`](../backend/README.md) to finish `backend/.env`, apply database migrations, and set up garment photo storage.
3. Optionally set `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend/.env` to enable text/image interpretation. Leave the key empty to use deterministic interpretation. The browser never receives this key.
4. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and allow that URL for local email confirmation redirects.
5. Start the API from `../backend` with `mvn spring-boot:run`.
6. Set the map tile URL and matching attribution values in the frontend environment for your tile provider, then run `npm install` and `npm run dev`.

The `.env.local` file is ignored by Git. The publishable key is designed for browser use; never put a database password, service-role key, or secret key into a `VITE_` variable.

## Current integration boundary

Database migrations and live API calls require the database connection password in the ignored local `backend/.env`. Mock checkout, simulated refunds, and memberships do not collect real money. Set `REWEAR_ADMIN_EMAILS` only to trusted administrator addresses. The pickup-hub table is intentionally empty until real hubs are verified and configured. Set a contracted map tile provider for production traffic; the OpenStreetMap public tile service is a development default.
