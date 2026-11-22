# Kirani

Kirani is a traceable grocery sourcing, procurement, processing and fulfilment platform. Development is on `feat/phase-1-foundation`; `main` remains the release baseline. Shared primitives are adapted from [varadatechworks/app-skeleton](https://github.com/varadatechworks/app-skeleton).

## Implemented development scope

- **Foundation:** Node.js modular monolith, PostgreSQL, checksum-tracked transactional migrations, tenant-scoped database access, JWT signature verification followed by database-backed active-user/role resolution, audit events, correlation IDs and consistent API errors.
- **Customer:** address CRUD/default selection, recurring basket versions, cycle-aware order preview/confirmation, immutable delivery-address snapshots, idempotent placement, order history and cancellation of eligible unpaid orders.
- **Farmer and procurement:** farmer profile submission/approval, seasonal listing review, PO issue and farmer response, partial acceptance/allocation release, GRN, accepted/rejected quantities and quality-reason capture.
- **Inventory and quality:** lot register, quantity-on-hand/reserved/available, append-only movement ledger, stock adjustments, FEFO/FIFO policy, reservation/release/consumption/expiry, partial lot transfers, warehouse locations, expiry metadata, quarantine, recall ancestry and stock-ledger reconciliation.
- **Mill processing and genealogy:** facility approval, operator assignment, stage templates, job acceptance/material receipt, mass balance, QC exceptions, output/by-product batches, quarantined finished stock and parent/source lineage.
- **Packaging and traceability:** order-line/package/lot allocation, opaque public trace tokens and recall propagation to affected lots/packages.
- **Delivery:** capacity-controlled slots, dispatch assignment, operator GPS route start, item-level delivered/refused quantities and partial proof of delivery.
- **Finance:** externally completed payment reconciliation records, refund request/approval/processed reconciliation, farmer payable accrual from accepted GRN quantity, reason-coded deductions and maker-checker farmer settlement batches.
- **Loyalty:** versioned effective-dated earning/redemption policy, configurable paise value per point, customer wallet/ledger, point-value snapshots, idempotent redemption and reward accrual gated on delivery plus payment settlement.
- **Engagement:** tenant-scoped in-app notifications/preferences, admin broadcasts, customer support tickets/messages, admin queue and operational report aggregates.
- **Web experience:** responsive admin, customer, farmer, mill and delivery workspaces, including finance/loyalty, support, reporting and traceability views. Current mobile experiences are responsive web/PWA previews, not native Android/iOS apps.

## Important integration boundaries

- **Payments:** current finance workflow records a payment that was completed externally (UPI/bank/card/COD/cash). It does not create a Razorpay/other gateway checkout, receive signed provider webhooks or initiate automated refunds.
- **Farmer payouts:** settlement batches have maker-checker approval and bank/UTR reconciliation, but no live bank payout API.
- **Notifications:** in-app inbox is implemented. Email, SMS and WhatsApp provider delivery, template approvals and campaign scheduling require provider selection/configuration.
- **Loyalty:** conversion values are versioned and snapshotted. Refund clawback/debt handling and direct referral rewards remain open; earning lots now support expiry dates, FEFO redemption and expiry sweeps.
- **Business/legal:** tax, invoice, sourcing/serviceability, quality, payout and refund policy decisions require Kirani owner/CA/legal confirmation before production.
- **Release:** no UAT sign-off or production readiness is claimed. See [module completion gates](docs/09-MODULE-COMPLETION-GATES.md) and [decision log](docs/08-DECISIONS-AND-OPEN-ITEMS.md).

## Local setup

Requires Node.js 20.6+ and PostgreSQL 15+.

1. Copy `.env.example` to `.env`. Configure `DATABASE_URL`, `AUTH_JWT_SECRET` (at least 32 random bytes), `AUTH_ISSUER` and `AUTH_AUDIENCE`.
2. Install: `npm install`.
3. Apply migrations: `node --env-file=.env src/db/migrate.mjs`.
4. Create a tenant/admin identity: `node --env-file=.env scripts/bootstrap-tenant.mjs`. This creates database identities and roles; it does not issue credentials.
5. For local-only testing, generate a 15-minute admin token: `NODE_ENV=development node --env-file=.env scripts/dev-token.mjs <user-id> <tenant-id>`. The token generator is disabled outside development.
6. Start: `node --env-file=.env src/server.mjs`; open `http://localhost:3000`.
7. Use **Connect API** in the web UI with a short-lived token from a trusted issuer. Tokens are held in page memory only.

Never commit `.env`, sample secrets or real customer/farmer data.

## API modules

All authenticated API routes are under `/api/v1`. Send `Authorization: Bearer <access-token>`; writes require JSON. Idempotent operations use an `Idempotency-Key` header where documented.

| Module | Representative endpoints |
|---|---|
| Session/catalogue/cycles | `GET /session/me`, `GET /catalogue/products`, `GET|POST /admin/monthly-cycles` |
| Customer orders | `GET|POST /customers/me/addresses`, `POST /customers/me/orders/preview`, `POST /customers/me/orders`, `GET /customers/me/orders`, `GET /orders/:id` |
| Farmer/procurement | `GET|PUT /farmers/me/profile`, `GET|POST /farmers/me/listings`, `POST /admin/procurement/orders`, `POST /admin/procurement/orders/:id/receipts` |
| Inventory/quality | `GET /admin/inventory/lots`, `GET /admin/inventory/summary`, `POST /admin/inventory/reservations`, `POST /admin/inventory/adjustments`, `GET /admin/inventory/reconciliation`, `POST /admin/inventory/recalls` |
| Processing/traceability | `POST /admin/processing/jobs`, `GET /mill/processing/jobs`, `POST /mill/processing/jobs/:id/stages`, `POST /admin/packing/packages`, public `GET /trace/:token` |
| Delivery | `POST /admin/delivery/slots`, `POST /admin/delivery/assignments`, `GET /delivery/assignments`, `POST /delivery/assignments/:id/pod` |
| Payments/refunds | `POST /admin/orders/:id/payments/record`, `GET /customers/me/orders/:id/payments`, `POST /customers/me/refund-requests`, `POST /admin/refunds/:id/decision`, `POST /admin/refunds/:id/record-processed` |
| Farmer settlements | `GET /admin/farmer-payables`, `POST /admin/farmer-settlements`, `POST /admin/farmer-settlements/:id/approve`, `POST /admin/farmer-settlements/:id/record-paid`, `GET /farmers/me/settlements` |
| Loyalty | `GET|POST /admin/loyalty/policies`, `GET /customers/me/loyalty`, `POST /customers/me/loyalty/redeem`, `POST /admin/loyalty/orders/:id/earn`, `POST /admin/loyalty/expire` |
| Notifications/support/reports | `GET /customers/me/notifications`, `POST /admin/notifications`, `POST /customers/me/support`, `GET /admin/support`, `GET /admin/reports/operations` |

## Verification

- `npm run migrate` applies versioned SQL migrations and verifies checksums.
- `npm run check` runs JavaScript syntax checks and the unit/PostgreSQL integration test suite.
- CI uses a disposable PostgreSQL service. It does not run production provider calls or UAT.
- Current completion estimates and remaining gates are tracked in [docs/09-MODULE-COMPLETION-GATES.md](docs/09-MODULE-COMPLETION-GATES.md).

## Production readiness still required

Configure a managed identity provider/MFA and secret store; provider credentials and signed webhooks; email/SMS/WhatsApp; bank payout; TLS/CORS/CSRF/rate limiting; backup and restore drills; monitoring/alerts; load and security testing; PII retention/redaction; Kannada/accessibility QA; mobile device testing; and formal UAT/business sign-off. Do not treat manual reconciliation endpoints as gateway or bank integrations.
