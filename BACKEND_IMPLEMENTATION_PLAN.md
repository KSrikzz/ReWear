# ReWear backend implementation plan

## Target architecture

- **Frontend:** existing React/Vite app. Keep the current role-aware registration and marketplace experience, replacing browser-local marketplace state with API data in deliberate slices.
- **Authentication:** Supabase Auth owns account creation, password sign-in, recovery, and sessions. The browser obtains a Supabase access token; Spring Boot receives it as a bearer token. Do not store passwords in application tables.
- **API:** Java Spring Boot REST API owns marketplace rules, role checks, rental state changes, product metrics, reviews, memberships, and fee calculations.
- **Database:** Supabase-hosted PostgreSQL, accessed from Spring Boot with Spring Data JPA/JDBC and schema migrations. Keep the database password and server secrets in deployment environment variables.
- **Images:** Supabase Storage for garment photos. Authorize uploads through user identity and listing ownership; store object paths and image metadata in PostgreSQL.

Spring Security Resource Server can validate JWTs using the issuer and signing keys, while Supabase documents its JWKS endpoint and token verification guidance. Supabase's Spring Boot quickstart demonstrates PostgreSQL/JDBC connectivity and recommends a session pooler or direct connection for typical ORM use. See [Supabase JWT guidance](https://supabase.com/docs/guides/auth/jwts), [Supabase Spring Boot quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot), and [Spring Security JWT resource server](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).

## Delivery sequence

## Implementation progress

The initial backend slice is now scaffolded in `backend/`:

- Spring Boot API on Java 21 with stateless bearer-token security, CORS, Actuator health, and environment-based Supabase settings.
- Flyway schema for profiles, business memberships, garments, bookings/events, reviews, personal commission ledger, membership webhook idempotency, and saved garments. A PostgreSQL exclusion constraint blocks overlapping open booking dates.
- API implementations for profile setup, public browsing and owner inventory, booking lifecycle, feedback, derived product activity, persisted membership preview, commission policy/ledger, and server-side preference ranking.
- Supabase Storage bucket and user-folder policies in `supabase/storage_setup.sql`.

The React context now uses Supabase Auth and these API contracts instead of the earlier browser-local marketplace state. Garment photos are uploaded to the configured Storage bucket. The project URL and browser publishable key are configured in an ignored local environment file. The database password is still missing, so Flyway migrations, live API calls, and end-to-end verification await a local database connection string.

The discovery slice now adds date-aware candidate filtering, deterministic preference scoring, optional server-side text and opt-in inspiration-image interpretation, saved style preferences, fit confidence, nearby public-area map pins, fulfillment and review signals, and owner-only garment lifecycle history. Flyway V6–V8 add discovery, lifecycle, delivery, and review storage. The AI key remains server-only and optional. The pickup hub table has no entries until verified locations are configured. Purchase transactions and payment processing are not implemented.

### 1. Create the backend foundation

Create a Spring Boot application with Web, Validation, Spring Security OAuth2 Resource Server, Spring Data JPA, PostgreSQL driver, and Flyway. Add health/readiness endpoints, consistent API error responses, request validation, CORS settings for the frontend origin, and environment-based configuration.

**Ready when:** the API starts without committed secrets, connects to Supabase Postgres over TLS, applies a migration, and rejects a missing or invalid token on protected routes.

### 2. Establish identity, profile, and roles

The single registration screen offers **Personal** and **Business** choices. Both become Supabase Auth users. After auth sign-up, create an application profile keyed by the Supabase user UUID, with a server-controlled role (`PERSONAL` or `BUSINESS`), display name, email, phone, and location. Business accounts also get a business profile. Prevent users from changing their role by editing client input or user metadata; role changes require a controlled server-side process.

Initial API surface:

- `GET /api/me` — return the authenticated profile and capabilities.
- `PATCH /api/me` — update permitted profile fields.
- Supabase Auth handles sign-up, sign-in, refresh, sign-out, and password recovery; Spring validates the resulting JWT on API calls.

**Ready when:** registration creates an Auth identity and matching profile exactly once, and all protected API actions use the verified user UUID and database role.

### 3. Add the marketplace data model and listing workflows

Use Flyway migrations rather than Hibernate-generated production schema. Suggested tables:

- `profiles`, `businesses`
- `garments` (owner, owner type, title, description, category, size, condition, location, daily price, deposit, availability, status)
- `garment_images` (storage path, ordering, alt text)
- `bookings` and `booking_events` (renter, garment, date range, price snapshot, status, actor, timestamp)
- `reviews` (booking, reviewer, garment, rating, text, created time)
- `business_memberships` (plan, status, billing period, provider reference)
- `commission_ledger` (booking, rate snapshot, gross, fee, net, settlement status)

Build business inventory create/edit/archive routes and personal wardrobe listing routes. Both roles can own listings, but only personal accounts can rent in the current product rules. The UI should make the account's available actions explicit.

Example API groups: `GET/POST /api/garments`, `GET/PATCH/DELETE /api/garments/{id}`, and `POST /api/garments/{id}/images/upload-url`.

**Ready when:** owners can manage only their own garments, image uploads are authorized, and public browsing returns only active listings with available image metadata.

### 4. Move rental requests and booking rules into the API

Implement `requested → confirmed → in_use → return_pending → completed`, plus decline/cancel paths, with every transition recorded in `booking_events`. Validate date ranges and prevent overlapping confirmed rentals at the database boundary as well as in service logic. Snapshot the agreed price and dates in each booking so later listing edits do not rewrite history.

Initial routes: `POST /api/bookings`, `GET /api/bookings/mine`, and `POST /api/bookings/{id}/confirm`, `/decline`, `/start`, `/return`, `/complete`, or `/cancel` (only expose transitions that fit the agreed workflow).

**Ready when:** role and booking ownership determine who may act, invalid state changes fail clearly, and simultaneous requests cannot double-book a garment.

### 5. Connect the frontend and remove local marketplace persistence

Replace `MarketplaceContext` localStorage reads/writes a page or capability at a time with a typed API client. Add Supabase Auth client configuration using public project URL/key only; send the short-lived access token on API calls. Restore the app session through Supabase Auth and `GET /api/me`. Use server error states, loading states, and empty states in the dashboards.

Suggested order: sign-up/sign-in and profile → browse/detail → business and personal listing management → booking workflows. Keep local demo fixtures only behind an explicit development/demo mode, then remove them from production paths.

**Ready when:** a fresh browser can sign up, sign in, browse, list, and rent using server data; reloading does not lose or fabricate marketplace state.

### 6. Add reviews and customer feedback

Allow one review per completed booking. Validate that the reviewer was the renter and the garment's booking reached `completed`. Show an aggregate rating, review count, and latest approved customer reviews on the garment detail page. Provide report/moderation handling before adding automated review filtering.

**Ready when:** feedback can only be submitted after usage is complete, duplicate reviews are rejected, and review ownership/history is retained.

### 7. Add product usage statistics and focused dashboards

Derive metrics from booking history rather than editable counters:

- **Times rented:** count of completed bookings (optionally show confirmed/upcoming separately).
- **Days used:** sum of actual `in_use` to `return_pending` durations for completed rentals; distinguish scheduled rental days from recorded usage days.
- **Current availability:** computed from active status and overlapping confirmed bookings.
- **Customer rating:** average and review count from eligible reviews.

Keep personal dashboards focused on active rentals, upcoming deadlines, saved/favourite garments, personal listings, and earnings after any displayed fee. Keep business dashboards focused on inventory, requests needing action, active rentals, completed rental revenue, and membership status. Remove decorative duplicate totals, unsupported sustainability claims, and metrics without a clear action.

**Ready when:** dashboard numbers reconcile to bookings and cannot be manually changed from the UI.

### 8. Add business membership billing

Keep plan entitlements separate from payment status. Define plan features (for example, listing limits and business analytics) in backend configuration/database, then integrate a payment provider with signed webhook verification and idempotent event handling. The existing “Studio preview” UI is only a prototype; do not present it as paid or active until provider checkout and webhooks work.

**Ready when:** a verified payment event activates the correct plan, cancellation/renewal updates entitlement reliably, and client-submitted plan labels cannot grant features.

### 9. Add personal lender commission and payouts

Make the fee rate an explicit, configurable policy and show the gross amount, fee, and estimated net before a personal owner publishes or accepts a rental. Record a rate and amount snapshot in `commission_ledger` for each completed rental. Build payout and refund handling around the chosen payment provider; never treat the current prototype estimate as a real charge or payout.

**Ready when:** the customer/owner sees the fee before confirming, ledger entries are auditable, and refunds/cancellations reconcile without editing historical bookings.

### 10. Add AI in bounded, explainable features

Start with optional listing assistance: suggest category, color, and a draft description from garment photos, always editable before publishing. Next add preference-based garment ranking from size, budget, category, location, and occasion. Show why a result was suggested and retain normal filters. Do not let AI set prices, approve users, decide disputes, or invent garment condition. Keep AI keys and calls on the server, set retention limits, and collect only the data needed for the feature.

**Ready when:** suggestions are optional, editable, explainable, and the marketplace remains usable when the AI provider is unavailable.

### 11. Production readiness

Add automated unit/integration coverage for roles, booking overlaps/transitions, fees, reviews, and webhook idempotency; structured logs and request IDs; rate limits on auth-sensitive routes; backups and migration rollback/recovery procedures; and deployment configuration for allowed origins, secrets, database TLS, storage policies, and monitoring.

## Login page status

`/login` uses Supabase Auth email/password sign-in and restores the profile and marketplace data from the API. Keep local `.env` and database credentials out of source control.
