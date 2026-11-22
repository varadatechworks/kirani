# Kirani

Kirani is a traceable grocery sourcing and fulfilment platform. Development is on `feat/phase-1-foundation`, using selected shared primitives adapted from [varadatechworks/app-skeleton](https://github.com/varadatechworks/app-skeleton).

## Current integrated foundation

- Responsive admin, farmer and customer web experiences served by the Node application.
- PostgreSQL connection pool, checksum-tracked transactional SQL migration runner and tenant bootstrap utility.
- JWT access-token verification followed by database-backed active-user and role resolution. Roles are never trusted solely from token claims.
- Tenant-scoped APIs for admin dashboard, product catalogue, monthly cycles, customer recurring basket versions, farmer listings/submissions/reviews and order visibility.
- Transactional writes and audit events for cycle creation/open/close, basket saves, product creation and farmer listing decisions.
- Consistent JSON response/error envelopes, correlation IDs, bounded JSON request bodies and security headers.
- Front-end API connector with a short-lived token held in memory only; the UI reports API errors instead of silently treating demo data as live data.

## Local setup

Requires Node.js 20.6+ and PostgreSQL 15+.

1. Copy `.env.example` to `.env`, configure `DATABASE_URL`, and set `AUTH_JWT_SECRET` to at least 32 random bytes. Configure the trusted token issuer and audience.
2. Install dependencies: `npm install`.
3. Apply migrations: `node --env-file=.env src/db/migrate.mjs`. The runner records checksums and adopts a complete existing Phase 1 schema if it was previously applied manually.
4. Create the first tenant/admin identity: `node --env-file=.env scripts/bootstrap-tenant.mjs`. This creates the tenant, role catalogue and active admin user, but does not issue credentials or tokens.
5. Configure a trusted identity provider to issue HS256 JWTs with `sub` (user UUID), `tenant_id`, `iss`, `aud`, `exp` and a roles array. Kirani verifies the signature and checks the user's active status and roles against PostgreSQL.
6. Start: `node --env-file=.env src/server.mjs`; open `http://localhost:3000`.

The admin bootstrap utility should be run once in a controlled environment. Do not commit `.env` or use sample secrets in deployment.

## API integration

Base path: `/api/v1`. Send `Authorization: Bearer <access-token>` and JSON for writes. Implemented routes:

- `GET /session/me`
- `GET /admin/dashboard`
- `GET /catalogue/products`; `POST /admin/catalogue/products`
- `GET /monthly-cycles/current`; `GET|POST /admin/monthly-cycles`; `POST /admin/monthly-cycles/:id/open`; `POST /admin/monthly-cycles/:id/close`
- `GET|PUT /customers/me/recurring-basket`
- `GET|POST /farmers/me/listings`
- `GET /admin/listings`; `POST /admin/listings/:id/decision`
- `GET /customers/me/orders`, `GET /admin/orders`, `GET /orders/:id`

The front-end Connect API action accepts a short-lived access token from the configured identity provider. The token remains in page memory only and is not written to localStorage/sessionStorage. No refresh-token or MFA flow is implemented in this phase.

## Important boundaries

Order confirmation, payment intents/webhooks/refunds, delivery execution, procurement purchase orders/goods receipts, mill processing, batch genealogy, package QR trace, loyalty ledger/redemption, notifications and recall workflows are not yet implemented as live API workflows. The current order APIs are read-only. No payment provider is configured. No native Android/iOS package is generated; the mobile experience is a responsive installable web app.

Before production: connect a managed identity provider and secret store; configure TLS, CORS/CSRF as appropriate to deployment, rate limiting, full request-schema validation, backups, alerting and retention; add DB-backed integration and browser E2E tests; verify migration upgrade/restore and conduct security review. The bootstrap command creates a user record but cannot authenticate anyone until a trusted issuer is configured to issue the matching JWT.
