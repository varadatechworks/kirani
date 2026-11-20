# Kirani

Kirani is a traceable, invite-only grocery sourcing and fulfilment platform. Phase 1 implementation is being developed on `feat/phase-1-foundation` using selected primitives adapted from [varadatechworks/app-skeleton](https://github.com/varadatechworks/app-skeleton).

## Current foundation

- Node.js 20+ ES modules and PostgreSQL migration baseline.
- Shared identity, authorization, consent-aware geolocation, audit redaction, integer money, maker-checker approval, workflow and observability primitives.
- Kirani domain rules for monthly basket versions/cutoffs and farmer listing approval.
- JWT verification helper and minimal health endpoints.
- Node built-in test suite.

## Local setup

1. Install Node.js 20+ and PostgreSQL 15+.
2. Copy `.env.example` to `.env` and set a strong secret and database URL.
3. Install dependencies with `npm install`.
4. Apply `migrations/0001_phase1_core.sql` using a migration runner or `psql "$DATABASE_URL" -f migrations/0001_phase1_core.sql`.
5. Run `npm test` and start with `npm start`.

The migration is an initial logical foundation, not a complete production schema. Do not expose this API publicly until persistence-backed authentication, authorization middleware, input schemas, rate limiting, CSRF/CORS policy, secrets management and operational controls are completed.

## Business invariants

- Customer access is invite-only.
- Farmer seasonal listings are not customer-visible until authorized admin approval.
- Recurring basket edits apply to the next eligible cycle and are blocked after cutoff.
- One-time additions must not silently repeat in later cycles.
- Payment and fulfilment states are independent.
- No silent substitution or price increase after order confirmation.
- Preserve farmer/supplier batch identity and full processing genealogy through to package QR traceability.
- Approval uses maker-checker separation.

## Quality

Run `npm test` and `npm run check`. Database migration validation and integration tests against PostgreSQL are required before production release.
