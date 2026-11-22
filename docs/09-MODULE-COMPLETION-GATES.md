# Kirani Module Completion and Release Gates

**Branch:** `feat/phase-1-foundation`  
**Purpose:** Define what 100% means for every Kirani module. A module is not complete merely because a screen or endpoint exists.

## Definition of 100%

Every module must satisfy all applicable gates below before it is marked 100%.

1. **Business rules:** All applicable BRD/SRS rules are implemented, including normal, exception and reversal paths.
2. **Backend:** Persisted domain model, tenant scoping, authorization, validation, state transitions, transactions, idempotency for retryable writes, audit trail and safe errors.
3. **Frontend:** Role-appropriate responsive screens, loading/empty/success/error states, accessible controls, field validation, confirmation for destructive actions and no browser prompts for production workflows.
4. **Integration:** Real API wiring, consistent request/response contracts, session handling, retry/conflict behavior and no fake/demo data represented as live.
5. **Tests:** Unit, PostgreSQL integration, authorization/tenant-isolation negative tests, boundary tests and browser-level end-to-end tests for critical paths.
6. **Operations:** Structured logs/metrics, migrations, backup/restore implications, configuration documentation and support/runbook notes.
7. **Release evidence:** CI green on the branch, UAT scenarios passed, known limitations recorded and required external provider configuration verified.

A provider-dependent module may be **code complete** while remaining **release blocked** until credentials, merchant onboarding, legal approvals or production callbacks are verified. Do not report it as production-ready.

## Current baseline

The original baseline was superseded by the customer ordering, procurement, inventory, processing and traceability work recorded below. Current browser mobile views remain previews, not native Android/iOS applications. The branch CI includes PostgreSQL-backed integration coverage; UAT and production-provider verification remain separate release gates.

## Module completion matrix

Status values: **Not started**, **In progress**, **Code complete**, **UAT verified**, **Release blocked**. Percentages must be updated only with evidence linked from CI/UAT.

| Module | Backend completion evidence | Frontend completion evidence | Integration/UAT evidence |
|---|---|---|---|
| Identity, authentication and sessions | Identity provider integration, token lifecycle, MFA policy, recovery, account activation/suspension, revocation | Sign-in, verification, MFA, recovery, session-expiry and access-denied UX | Expired/revoked token, disabled user, wrong tenant, MFA and role-negative tests |
| Tenant and RBAC | Tenant lifecycle, role/permission matrix, least privilege, separation of duties | Tenant-aware navigation and permission-aware actions | Cross-tenant IDOR tests for every resource and role matrix |
| Customer onboarding and serviceability | Invitation/approval, phone verification adapter, profile, service-area/pincode validation | Registration/invitation, verification, profile and serviceability UX | New/ineligible/suspended customer and duplicate identity flows |
| Customer addresses | Address CRUD, validation, service-area checks, default address and immutable order address snapshot | Add/edit/select/default address, map/pincode-assisted entry and validation | Invalid pincode, out-of-area, deleted/changed address after order |
| Catalogue and pricing | SKU/pack/units, categories, effective-dated pricing, tax and availability rules | Search/filter/category/product details, price/unit display and admin maintenance | Price change, inactive product, invalid unit and stale price tests |
| Monthly cycles and basket | Cycle configuration, timezone/cutoff, versioned recurring basket, one-time basket | Cycle selection, recurring and one-time basket editing, cutoff messaging | Cutoff boundary, concurrent edits, basket version immutability |
| Order preview and confirmation | Server-side pricing, immutable line/address/price snapshot, stock/serviceability checks, idempotent confirmation | Review quantities, price/tax, delivery window, explicit confirm and receipt | Duplicate submission, stale price, cutoff, concurrent confirmation |
| Order lifecycle | State machine, authorized transitions, cancellation policy, amendments as compensating events | Order details, tracking, cancellation request and status timeline | Invalid transition, cancellation race, partial cancellation and audit tests |
| Farmer onboarding and profile | Farmer/farm identity, documents, location, verification, payout profile with restricted access | Farmer profile, document submission, verification status | Consent/access, invalid documents, approval/rejection and sensitive-data tests |
| Farmer seasonal listings | Availability, harvest/readiness, declarations, evidence, expiry, reapproval on material change | Listing create/edit/withdraw and review feedback | Approval, rejection, changes requested, expiry, suspend/withdraw |
| Procurement planning | Demand aggregation by SKU/area/date, approved supply matching and shortage planning | Procurement planner and exceptions dashboard | Reconcile confirmed demand against supply and prevent over-allocation |
| Purchase orders and supplier quotes | Quotes, comparison, approvals, PO issue/change/cancel and supplier commitments | Procurement workbench and supplier-facing PO views | Maker-checker, partial PO, duplicate PO, price/quantity changes |
| Goods receipt and quality | GRN, weighment, lot/batch creation, variance, QC outcomes and quarantine | Receiving, inspection checklist, evidence upload and disposition | Partial/over receipt, rejected goods, quarantined stock cannot be used |
| Mill/facility processing | Jobs, stage configuration, operator/equipment, input/output, by-products, waste and mass balance | Mill portal, scan/start/complete stages, QC and exception workflow | Unauthorized batch consumption, tolerance breach and correction events |
| Inventory and batch genealogy | Stock ledger, location/condition, reservations, transfers, adjustments, FEFO/FIFO and genealogy | Stock dashboard, batch ledger, holds and adjustment approval | No negative stock, quarantined stock blocked, full ledger reconciliation |
| Package and QR traceability | 88% | 78% | 90% | Unique package identity/public token, order-line-to-lot allocation, inventory consumption, recursive batch ancestry, public trace API and recall propagation; printable QR artwork/label layout, customer-facing trace page and token revocation remain |
| Delivery and proof of delivery | Delivery slots, dispatch, route assignment, partial/failure reasons, POD and COD capture | Delivery operator app views, customer tracking and POD capture | Failed/partial/refused delivery, duplicate POD and COD reconciliation |
| Payments and refunds | Provider adapter, signed webhooks, idempotent ledger, partial/full refunds and reconciliation | Checkout, payment status, receipts and refund status | Invalid signature, duplicate/out-of-order webhook, timeout and refund replay |
| Farmer/supplier payables | Payable ledger, deductions with reason, settlement batches and reconciliation | Farmer statement, payable detail and finance approval | Partial settlement, reversal, duplicate payout and maker-checker |
| Loyalty and referral | Versioned earning/conversion policies, immutable lots, redemption, expiry and reversals | Points balance, ledger, redemption and referral status | Policy effective-date change preserves historical conversion; refunds reverse rewards |
| Notifications and campaigns | Template/provider adapters, preferences, scheduling, frequency caps, retries and delivery log | Notification inbox, preferences and campaign administration | Provider failure, duplicate suppression, opt-out and locale rendering |
| Support and feedback | Tickets, SLA, ownership, escalation, resolution and links to order/payment/package | Customer support, admin queue and feedback UX | Unauthorized access, SLA breach and full history |
| Reports and analytics | Tenant-scoped aggregates, reconciled financial/operational metrics and export controls | Role-specific dashboards, filters, drill-down and accessible charts | Report totals reconcile to source ledgers and respect tenant/role scope |
| Audit, security and privacy | Append-only audit, retention, redaction, rate limits, secrets, threat mitigations | Clear status/error messaging and safe sensitive-data handling | OWASP/API security, IDOR, injection, abuse, privacy and audit completeness |
| Localization and accessibility | Locale-aware formats and translatable server messages | Kannada/English, responsive layouts, keyboard/screen-reader support | Locale, currency/date/quantity and accessibility smoke tests |
| Android and iOS applications | Shared API contracts, secure token storage, push/deep links and release configuration | Native or approved cross-platform customer/farmer/operator experiences | Device matrix, offline/network recovery, app signing and store/UAT release |
| Deployment and operations | Production config, migrations, backups, restore, monitoring, alerts and rollback | Deployment health/admin diagnostics where appropriate | Staging/prod smoke, restore drill, load/security tests and runbooks |

## Delivery sequence

1. Finish customer foundation: onboarding, addresses, basket, preview, confirmation and order lifecycle.
2. Finish farmer foundation: profile, verification, seasonal listings and payout profile.
3. Build demand planning, quotes, purchase orders and goods receipt.
4. Build mill processing, batch genealogy, inventory, quality and recall.
5. Build packaging, QR traceability, delivery and proof of delivery.
6. Build payment/refund, finance/payables and loyalty.
7. Build notifications, support, reports, localization and native apps.
8. Complete production security, performance, backup/restore, observability, UAT and release readiness.

## Progress reporting rules

- Report Backend, Frontend and Integration separately for each module.
- 100% requires all applicable gates and evidence; a passing unit test alone is insufficient.
- Distinguish implementation percentage from UAT/release readiness.
- Do not count mock data, preview-only UI, TODO routes or provider stubs as completed integration.
- Keep dependencies and external blockers explicit.
- Recalculate overall progress by weighted scope, not by averaging a few implemented modules.


## Development progress snapshot (UAT excluded)

Updated after inventory, processing, traceability, delivery, loyalty, engagement and finance implementation. Percentages are engineering estimates based on persisted backend workflows, role-aware UI wiring and automated PostgreSQL integration coverage. They exclude UAT and live provider verification.

| Module | Backend | Frontend | Integration | Remaining development gates |
|---|---:|---:|---:|---|
| Identity, tenant and RBAC | 80% | 65% | 70% | External identity provider, MFA/recovery, full role matrix, tenant IDOR suite, session revocation |
| Customer addresses | 95% | 90% | 92% | Pincode/service-area validation and browser E2E |
| Catalogue and pricing | 80% | 75% | 78% | Effective-dated price/tax, packs/variants and full search/filter UX |
| Monthly cycles and recurring basket | 80% | 75% | 78% | One-time basket, cycle timezone/cutoff edge cases, substitutions and version UX |
| Order preview, placement and lifecycle | 90% | 85% | 88% | Paid/partial cancellation, amendments, serviceability and browser E2E |
| Farmer onboarding and seasonal listings | 90% | 85% | 88% | Document upload/verification provider, edit/withdraw/expiry UX and payout profile |
| Procurement planning and purchase orders | 90% | 88% | 90% | Demand-by-delivery-date planner now reconciles confirmed orders with expiry-valid stock and unallocated approved farmer supply; supplier quote comparison, PO amendments/cancellation and approval limits remain |
| Goods receipt and quality | 90% | 85% | 90% | Weighment evidence, QC checklist configuration and browser E2E |
| Mill processing and batch genealogy | 90% | 85% | 92% | Rework/correction workflows, multi-source merge approval, operator/equipment evidence and E2E |
| Inventory, expiry and recall | 97% | 92% | 97% | Automated distributed-safe reservation expiry worker, append-only stock ledger, expiry-aware FEFO/FIFO, partial transfers, reconciliation and recall ancestry; deeper concurrent stress, full tenant matrix and browser E2E remain |
| Packaging and QR traceability | 95% | 92% | 95% | Customer-facing source/batch trace page, generated SVG QR label, print action and PII-minimized trace response; token revocation, scan-device matrix and browser E2E remain |
| Delivery slots and proof of delivery | 88% | 85% | 90% | COD-to-payment reconciliation, photo/signature evidence, failed-delivery reattempts and route E2E |
| Payments and refunds | 82% | 78% | 88% | Razorpay order-intent creation, checkout UI, raw-body HMAC webhook verification, capture idempotency, amount/currency checks, event exception register and offline reconciliation; live credentials, provider certification and automated refund API remain |
| Farmer payables and settlement | 85% | 80% | 88% | Bank payout integration, tax/fee policy, settlement reversal and statement export |
| Loyalty wallet and conversion | 92% | 88% | 92% | Effective-dated conversion, immutable point-value snapshots, expiry-aware point lots, FEFO redemption, expiry sweep and one-level direct referrals; refund clawback/debt and deeper effective-date scenarios remain |
| Notifications and support | 80% | 75% | 82% | Email/SMS/WhatsApp providers, templates, SLA/escalation, campaigns and delivery receipts |
| Reports and analytics | 75% | 70% | 80% | Operations, finance reconciliation and traceability/quality aggregates; date filters, drill-down, exports, scheduled snapshots and source-ledger cross-checks remain |
| Audit, privacy and production security | 60% | 50% | 60% | Tenant/role checks, append-only ledgers, correlation/audit events, bounded per-IP API rate limit and security response headers; distributed gateway limits, threat modelling, PII retention/redaction, MFA, secret rotation and penetration testing remain |
| Localization and accessibility | 35% | 30% | 25% | Complete Kannada translations, locale coverage, keyboard/screen-reader and accessibility testing |
| Native Android/iOS applications | 0% | 0% | 0% | Not started; current customer/farmer/operator experiences are responsive web/PWA previews |
| Deployment and operations | 50% | 30% | 40% | Production hosting/identity/provider setup, backups/restore drill, monitoring, load test and rollback runbook |

No single product-wide completion percentage is asserted here. The matrix makes the remaining work visible; UAT, production credentials and business/legal approvals remain separate release gates.

## Inventory control implementation update

Implemented on `feat/phase-1-foundation`:
- Append-only inventory movement ledger with opening balances and goods-receipt entries.
- Explicit on-hand, reserved and available balances with a database consistency constraint.
- Audited positive/negative stock adjustments with protection against reducing on-hand below reserved stock.
- FEFO reservation allocation across oldest eligible lots, transactional row locks and idempotent replay.
- Reservation register, reason-required release and explicit consumption/issue workflow.
- Tenant-specific warehouse locations, automatic main-warehouse provisioning and audited whole-lot transfers.
- Lot quality transitions for available, quarantined and recalled stock; held/recalled lots are excluded from available-stock summaries, and lots with active reservations cannot be held or recalled.
- Admin workspace for stock adjustment, reservation, release, lot quality actions and ledger review.
- PostgreSQL integration coverage for reservation replay, balance changes, release, invalid negative adjustment, quality hold/release, ledger events and role denial.

Latest combined CI for processing, inventory, delivery, finance, demand planning and QR traceability: [Kirani CI run 45011814692](https://github.com/varadatechworks/kirani/actions/runs/45011814692) passed migrations and `npm run check`. UAT has not been performed.

Remaining inventory work before 98%: deeper concurrent-write and tenant-isolation stress tests, recall closure evidence and browser-level end-to-end verification of the admin controls.


## Processing, inventory and traceability implementation update

Implemented on `feat/phase-1-foundation`:
- Mill facility onboarding, admin approval, operator assignment and facility-specific stage templates.
- Processing jobs reserve an approved source lot; mill operators accept and confirm physical material receipt.
- Stage records enforce sequence and input quantity, capture saleable/by-product outputs, waste, loss, remaining material, adjustment, moisture and QC outcome.
- Mass-balance deviations create reviewable exceptions; failed QC blocks subsequent processing. Output batches retain source-lot/parent-output genealogy.
- Completed output batches are created as quarantined inventory lots; Kirani inspection is required before stock is released.
- Package IDs and opaque public tokens bind customer order lines to inventory lots. Public trace returns product and batch lineage without farmer contact or private address details.
- A polished customer-facing `/trace/{token}` page and generated SVG QR print labels are now wired into the packing workspace; the canonical `PUBLIC_APP_URL` is required for absolute QR destinations.
- Source recalls recursively identify transferred and processed descendant lots, release active reservations, block affected inventory and mark impacted packages recalled.
- Inventory now captures best-before/expiry dates, excludes expired stock from reservations/packing/processing, supports FIFO/FEFO policy, partial lot transfers using child-lot identity, reservation expiry sweeps, append-only ledger enforcement and ledger-to-stock reconciliation.
- A distributed-safe background worker now runs reservation expiry on startup and at a configurable interval, using a PostgreSQL advisory lock so multiple app instances do not release the same reservation twice.
- Admin screens now include mill operations, package packing/trace register, expiry controls, partial transfers, recall impact and reconciliation status.

Latest verified automated inventory integration run for the expiry/partial-transfer/reconciliation changes: [Kirani CI run 44992266010](https://github.com/varadatechworks/kirani/actions/runs/44992266010) — 16 tests passed, migrations and syntax checks passed. The subsequent recall ancestry enhancement is undergoing its own CI run. UAT has not been performed.

Remaining gates before 98%: browser-level end-to-end tests, full tenant/role matrix, multi-stage rework and correction workflows, scheduled reservation-expiry execution, print-ready QR labels/customer trace page, and extended concurrency/recall scenarios.


## Delivery implementation update

Implemented on `feat/phase-1-foundation`:
- Admin can create dated delivery slots with start/end times, cutoff and capacity.
- Dispatch assignment requires a packed package, an active delivery-operator account and remaining slot capacity. An order cannot have two concurrent active assignments.
- Delivery operators see only their own assignments, capture GPS at route start and submit item-level proof of delivery with recipient, delivered/refused quantities and short-delivery reasons.
- Partial deliveries preserve the outstanding order quantity and can be assigned again when additional packed quantities are available; POD quantities are capped by both remaining order quantity and packed quantity.
- Delivery events, GPS coordinates, POD records and order/package state changes are persisted and audited.

Automated CI covering the delivery slot, assignment, GPS start and partial-POD workflow passed in [Kirani CI run 44992914651](https://github.com/varadatechworks/kirani/actions/runs/44992914651) (16 tests passed). Follow-up inventory reservation/recall hardening is being checked in a newer CI run. UAT has not been performed.

## Finance, loyalty and engagement implementation update

Implemented on `feat/phase-1-foundation`:
- Razorpay payment-intent creation and customer checkout are implemented behind environment credentials. Signed raw-body webhooks verify HMAC-SHA256, bind provider orders to Kirani intents, reject mismatched/over-captures, prevent duplicate captures and store only minimal payment fields in the gateway-event ledger.
- Admin finance now shows live credential readiness and verified webhook exceptions. Offline UPI, bank transfer, external card, COD and cash entries remain manual reconciliation records.
- Customer refund requests, admin maker-checker approval, and reconciliation after an external refund has actually been completed. Refund amount cannot exceed captured, unrefunded transactions.
- Farmer payable accrual from quality-accepted GRN quantities at the PO unit price; reason-coded deductions; settlement batch creation; different-admin approval; bank/UTR reference recording; farmer payable and settlement statements.
- Effective-dated, versioned loyalty conversion policies with point-value snapshots, customer wallet/ledger, delivery-and-payment-gated earning, redemption caps, expiry-aware point lots, FEFO redemption, expiry sweep, one-level referral codes and qualification rewards, and idempotency.
- Tenant-scoped in-app notifications, category preferences, admin broadcast by user/role, read receipts, customer support tickets/messages, internal notes, priority/status/assignment, plus operations, financial reconciliation and traceability/quality reports.
- Admin finance/loyalty, support and reports workspaces; customer rewards/inbox/support panels; farmer earnings/settlement view.

Automated Razorpay refund submission, bank payout integration, email/SMS/WhatsApp providers, campaign scheduling, full financial reporting and loyalty refund clawback/debt remain. Direct one-level referral rewards are implemented. Configure credentials and business policies before production.

## Security hardening update

- Added a bounded per-client API rate limiter with configurable `API_RATE_LIMIT_PER_MINUTE` and `API_RATE_WINDOW_MS`; trusted forwarded-IP parsing is opt-in via `TRUST_PROXY=true`.
- Added frame, content-type, referrer and cross-origin resource policy headers plus HSTS when TLS is direct or a trusted proxy reports HTTPS.
- Kept same-origin camera/GPS permissions available for operator workflows.
- Unit tests cover limit windows and trusted-proxy key selection; PostgreSQL integration tests also cover tenant isolation for order and inventory reads.

The in-process limiter is a single-instance safeguard, not a distributed quota. Production multi-instance deployments should enforce an additional shared gateway/WAF limit. MFA, identity-provider integration, secret rotation, threat modelling and penetration testing remain release gates.

## Latest integrated verification

[Kirani CI run 45011814692](https://github.com/varadatechworks/kirani/actions/runs/45011814692) completed successfully on the feature branch. PostgreSQL migrations and `npm run check` passed. Coverage includes customer order/checkout, demand planning, procurement and GRN, inventory reservation expiry/ledger/recall, mill processing, package trace and QR label generation, delivery/POD, signed Razorpay webhook replay and duplicate-capture handling, refund reconciliation, farmer settlement maker-checker, loyalty expiry/referrals, notifications/support/reports, cross-tenant access and rate-limiter behavior.

This is automated development verification only. No browser UAT, live gateway/bank/provider transaction, production deployment or mobile store build has been completed.
