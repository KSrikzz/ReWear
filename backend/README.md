# ReWear API

Java 21 / Spring Boot REST API. It verifies Supabase Auth access tokens and stores marketplace data in Supabase PostgreSQL. Flyway applies the SQL in `src/main/resources/db/migration` when the service starts.

## Supabase setup

1. Create a project at [Supabase](https://supabase.com/dashboard/projects).
2. Open **Project Settings → API** and note the project URL. The frontend will need the project URL and public/publishable key; these are not passwords. Do not put a service-role/secret key in the browser.
3. In **Project Settings → JWT Keys**, confirm the project uses an asymmetric signing key so Spring can validate tokens from the project's JWKS endpoint. The expected URLs are `https://<project-ref>.supabase.co/auth/v1` and `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`.
4. Open **Connect → Session pooler → JDBC** and copy the connection URL. Keep `sslmode=require`. Do not choose the transaction pooler for this JDBC app.
5. `backend/.env` has been prepared locally with this project's URL, issuer, and JWKS address. Open Supabase **Connect → Session pooler → JDBC**, copy its full JDBC string, and paste it after `SUPABASE_DB_URL=` in `backend/.env`. Replace the password placeholder locally. Keep `.env` private and do not paste it into chat.
6. Flyway applies the relational schema. Run [`../supabase/storage_setup.sql`](../supabase/storage_setup.sql) in the Supabase SQL editor to create the garment photo bucket and owner-folder policies if your environment has not already applied it.

The database connection password is only read by Spring Boot. The browser receives only the public Supabase URL/key, and Supabase Auth issues the user's access token. Spring Security verifies that token before protected API requests. This API uses the project's asymmetric JWT signing keys via JWKS; confirm the signing key setting under **Project Settings → JWT Keys** before testing sign-in.

## Start locally

From this directory, run `mvn spring-boot:run`. The first startup connects to PostgreSQL and applies all Flyway migrations. The health endpoint is `http://localhost:8080/actuator/health`.

## API available in the first backend slice

- Public browsing: `GET /api/garments`, `GET /api/garments/{id}`
- Authenticated profile: `POST /api/profiles`, `GET /api/me`, `PATCH /api/me`
- Wardrobe management: `GET /api/garments/mine`, `POST /api/garments`, `PUT /api/garments/{id}`, `PATCH /api/garments/{id}/availability`, `PATCH /api/garments/{id}/lifecycle`, `GET /api/garments/{id}/lifecycle`
- Saved outfits: authenticated `GET /api/garments/saved`, `PUT /api/garments/{id}/saved`, and `DELETE /api/garments/{id}/saved`; favorites are stored per profile in `saved_garments`.
- Rental requests: `GET /api/bookings/mine`, `POST /api/garments/{id}/bookings`, `POST /api/bookings/{id}/transitions`; delivery PIN coverage is checked server-side and shown to the owner after confirmation.
- Customer feedback: `GET /api/garments/{id}/reviews` with rating, photo, and sort filters; `GET /api/reviews/mine`; `POST /api/bookings/{id}/reviews`; `POST /api/reviews/{id}/helpful`
- Membership preview: `GET /api/memberships/plans`, `GET /api/memberships/mine`, `POST /api/memberships/select`
- Personal lender policy and ledger: `GET /api/commission/policy`, `GET /api/commission/mine`
- Mock payments: `POST /api/payments/bookings/{id}/simulate`, `POST /api/payments/bookings/{id}/cancel`, `POST /api/payments/memberships/simulate`, `GET /api/payments/mine`
- Rental protection and claims: `GET /api/protection/terms`, `GET /api/protection/claims/mine`, `POST /api/protection/claims/bookings/{id}`, provider response at `PATCH /api/protection/claims/{id}/response`
- Admin-only reports and claim decisions: `/api/admin/overview`, `/users`, `/memberships`, `/garments`, `/rentals`, `/payments`, `/claims`
- Outfit discovery: `POST /api/recommendations/discover`, `GET/PUT/DELETE /api/recommendations/preferences`, and public `GET /api/locations/hubs`

Outfit discovery applies date overlap, requested radius, price, size, area/PIN code, fulfillment, condition, rating, and premium filters in the service before explainable server scoring. `OPENAI_API_KEY` is optional: when set, the server uses the Responses API to interpret text and an explicitly consented inspiration image; without it, deterministic interpretation remains available. Body measurements are used only to estimate fit confidence and are not sent to the AI provider or saved as preferences. Precise browser coordinates are rounded before search and listing locations are rounded before storage.

Migration V6 adds discovery metadata, private saved preferences, and a pickup hub table. The hub table starts empty; do not show a map hub until a real, verified hub has been configured. Migration V7 adds owner-only condition, maintenance, repair, retirement, and reactivation history. Migration V8 stores delivery PINs with requests, review photo paths, and helpful votes. Retired and maintenance listings are excluded from public discovery.

Rental and membership checkout are simulated by `REWEAR_MOCK_GATEWAY`; the API calculates all amounts and never contacts a bank/payment provider. Personal and membership fees, protection premiums, coverage limits, claim windows, and high-value rules are environment-configurable. Example defaults are in `.env.example`; production values should be selected for the business model.

Configure trusted administrator email addresses using `REWEAR_ADMIN_EMAILS`. The backend promotes only those verified Supabase identities to the admin role, and every `/api/admin/**` operation checks the stored profile role. Configure a tile URL suited to expected traffic before public map launch. No delivery carrier integration or automated image moderation is connected.
