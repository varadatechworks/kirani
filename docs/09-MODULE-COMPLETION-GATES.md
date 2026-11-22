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

Snapshot after the customer ordering and farmer procurement implementation commits. These are engineering estimates based on code, automated integration coverage and frontend wiring; they do **not** include UAT sign-off.

| Module | Backend | Frontend | Integration | Development notes |
|---|---:|---:|---:|---|
| Tenant isolation and role enforcement | 80% | 50% | 65% | Tenant-scoped API and role checks; full permission matrix and onboarding UX remain |
| Customer addresses | 95% | 90% | 92% | CRUD, default address, validation and tenant/customer ownership tests |
| Catalogue | 80% | 75% | 78% | Tenant catalogue, pricing and customer display; effective-dated price/tax rules remain |
| Monthly cycles | 80% | 70% | 75% | Create/open/close and customer cycle read; full schedule and cutoff UX remains |
| Recurring basket | 80% | 75% | 78% | Versioned basket and product availability checks; one-time basket and substitutions remain |
| Order preview and placement | 90% | 85% | 88% | Server-side totals, address snapshot, idempotency and order history |
| Order cancellation and detail | 85% | 80% | 83% | Customer-owned unpaid placed orders can be cancelled with reason; policy-driven paid/partial cancellation remains |
| Farmer profile and verification | 90% | 85% | 88% | Profile submission, admin review and farmer-facing status |
| Farmer seasonal listings | 85% | 75% | 80% | Submission, approval/rejection and audit; availability expiry and edit/withdraw UX remain |
| Procurement purchase orders | 85% | 80% | 83% | Admin PO issue, farmer accept/reject, partial accepted quantity and allocation release |
| Goods receipt and quality | 90% | 85% | 90% | GRN posting, partial receipts, accepted/rejected split, reason capture, lot creation and over-receipt protection; UAT excluded |
| Mill processing and batch genealogy | 0% | 0% | 0% | Not started |
| Inventory management and lot control | 90% | 88% | 92% | Tenant-scoped lot register/summary, on-hand/reserved/available balances, receipt/opening/adjustment/reserve/release/consume/transfer/quality ledger events, FEFO reservation, whole-lot location transfers, reservation consumption and admin controls; partial transfers, immutable-ledger enforcement, expiry/reconciliation and recall impact workflow remain |\n| Packaging and QR traceability | 0% | 0% | 0% | Not started |
| Delivery slots and proof of delivery | 10% | 0% | 0% | Delivery date selection only; slot capacity, route assignment, delivery scans and POD remain |
| Payments, refunds and reconciliation | 0% | 0% | 0% | Provider onboarding and payment ledger not implemented |
| Farmer payables and settlement | 0% | 0% | 0% | Not started |
| Loyalty wallet and configurable conversion | 0% | 0% | 0% | Not started |
| Notifications and support | 0% | 0% | 0% | Not started |
| Reports and analytics | 20% | 25% | 20% | Dashboard metrics exist; reconciled reporting remains |
| Production identity, security and operations | 45% | 35% | 40% | JWT/tenant controls, correlation IDs and CI exist; MFA, provider integration, threat review and production operations remain |
| Native Android and iOS apps | 0% | 0% | 0% | Current mobile experiences are responsive browser previews, not native apps |

**Overall product development is still below 50%.** Inventory, processing and traceability have materially advanced but are not yet at the requested 98% gates. Delivery/POD, payments/refunds, farmer settlements, loyalty, notifications/support, reports, production operations and native apps remain major unfinished areas. A product-wide 95% figure cannot be claimed.


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

Latest verified inventory CI: [Kirani CI run 44986172913](https://github.com/varadatechworks/kirani/actions/runs/44986172913) — migrations and `npm run check` succeeded. UAT has not been performed.

Remaining inventory work before 98%: partial-lot transfers, immutable-ledger enforcement, reservation expiry and automated expiry release, stock-vs-ledger reconciliation, recall impact/trace-back workflow, deeper concurrent-write and tenant-isolation tests, and browser-level verification of the admin controls.


## Processing, inventory and traceability implementation update

Implemented on `feat/phase-1-foundation`:
- Mill facility onboarding, admin approval, operator assignment and facility-specific stage templates.
- Processing jobs reserve an approved source lot; mill operators accept and confirm physical material receipt.
- Stage records enforce sequence and input quantity, capture saleable/by-product outputs, waste, loss, remaining material, adjustment, moisture and QC outcome.
- Mass-balance deviations create reviewable exceptions; failed QC blocks subsequent processing. Output batches retain source-lot/parent-output genealogy.
- Completed output batches are created as quarantined inventory lots; Kirani inspection is required before stock is released.
- Package IDs and opaque public tokens bind customer order lines to inventory lots. Public trace returns product and batch lineage without farmer contact or private address details.
- Source recalls recursively identify transferred and processed descendant lots, release active reservations, block affected inventory and mark impacted packages recalled.
- Inventory now captures best-before/expiry dates, excludes expired stock from reservations/packing/processing, supports FIFO/FEFO policy, partial lot transfers using child-lot identity, reservation expiry sweeps, append-only ledger enforcement and ledger-to-stock reconciliation.
- Admin screens now include mill operations, package packing/trace register, expiry controls, partial transfers, recall impact and reconciliation status.

Latest verified automated inventory integration run for the expiry/partial-transfer/reconciliation changes: [Kirani CI run 44992266010](https://github.com/varadatechworks/kirani/actions/runs/44992266010) — 16 tests passed, migrations and syntax checks passed. The subsequent recall ancestry enhancement is undergoing its own CI run. UAT has not been performed.

Remaining gates before 98%: browser-level end-to-end tests, full tenant/role matrix, multi-stage rework and correction workflows, scheduled reservation-expiry execution, print-ready QR labels/customer trace page, and extended concurrency/recall scenarios.
