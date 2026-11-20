# Kirani Phase 1 — Software Requirements Specification (SRS)

**Version:** 1.0 | **Status:** Draft for engineering/product review

## 1. Purpose and conventions
This SRS translates the BRD into testable software behaviour. Requirements are labelled FR (functional), NFR (quality), SEC (security), DATA (data integrity) and AC (acceptance). “Must” is mandatory for Phase 1. All timestamps are stored in UTC and displayed in the configured business/service-area timezone. Money uses integer minor units (e.g. paise) plus ISO currency; quantities use fixed-precision decimal plus explicit unit.

## 2. System context and interfaces
- Customer interface: responsive mobile-first web/PWA or shared mobile app; basket, confirmation, payment, order tracking, QR trace, support.
- Farmer/supplier interface: profile, documents, listings, availability, sourcing responses, deliveries and payment status.
- Kirani operations interface: customer access, catalogue, cycles, pricing, approvals, demand, procurement, inventory, quality, packing, delivery, finance, campaigns and reports.
- Mill interface: restricted assigned-job workbench; scan, receipt, stages, quantities, QC, outputs and dispatch.
- External systems: payment gateway, SMS/WhatsApp/email/push providers, object storage and optional maps/geocoding.

## 3. Functional requirements

### Identity and access
- FR-001: System shall support invitation creation, expiry, revocation and redemption rules.
- FR-002: System shall verify customer mobile number before activation.
- FR-003: Admin shall approve, suspend and reactivate customers, farmers, suppliers and mills with reason and audit.
- FR-004: Authorization shall be enforced server-side for every resource/action; UI hiding is not authorization.
- FR-005: Privileged users shall use MFA; session expiry/revocation shall be configurable.
- FR-006: User roles and permissions shall support least privilege and scoped access (e.g. mill user sees assigned jobs only).

### Customer catalogue and basket
- FR-010: Customer shall browse active products, pack options, price basis, availability and approved source/claim details.
- FR-011: Customer shall create/update recurring basket; each saved change creates a version/effective-cycle reference.
- FR-012: Customer shall create one-time basket attached to exactly one open/future cycle.
- FR-013: System shall prevent one-time lines from being copied into future recurring baskets.
- FR-014: Customer shall preview combined recurring and one-time items, estimated total, delivery window, availability and policy notes.
- FR-015: System shall create an immutable monthly order snapshot only after explicit confirmation.
- FR-016: Recurring changes after confirmation shall not mutate that order.
- FR-017: System shall enforce cycle cutoff using server time and configured timezone; admin override requires permission, reason and audit.
- FR-018: Customer shall set substitution preference per product/order; no unapproved substitute is allowed.
- FR-019: Customer shall see order history, invoices/receipts, status and issue submission.

### Monthly cycles and demand
- FR-020: Admin shall configure cycle dates, cutoff, reminder schedule, service areas and delivery windows.
- FR-021: System shall notify eligible customers before cutoff according to preferences and frequency policy.
- FR-022: At cutoff, unconfirmed baskets shall be marked NOT_CONFIRMED/EXPIRED and excluded from procurement by default.
- FR-023: Demand aggregation shall consolidate by SKU, specification, unit, service area and needed date while preserving order-line/customer references and basket type.
- FR-024: Admin shall preview, version and approve procurement demand plan; approved plan changes are audited.

### Farmer/supplier and product discovery
- FR-030: Farmer/supplier shall maintain profile, verification evidence, farm/source details, product declarations and availability.
- FR-031: Farmer may submit seasonal listing; listing remains private until approved.
- FR-032: Admin shall approve, reject, request changes, suspend or expire listings.
- FR-033: Material listing edits shall trigger configurable reapproval.
- FR-034: Customer shall submit a product request and view its status.
- FR-035: Admin shall review, clarify, reject, approve or aggregate similar requests without losing individual request identity.
- FR-036: Admin shall publish sourcing opportunities to selected eligible farmers/suppliers.
- FR-037: Farmer/supplier shall respond with quantity, price, availability, terms and source evidence; response is not a PO.
- FR-038: Authorized procurement user shall evaluate responses and issue purchase order.

### Procurement, receipt and inventory
- FR-040: System shall support quotation comparison and purchase order lifecycle including approval limits.
- FR-041: PO shall capture source, item, quantity/unit, price, quality criteria, delivery schedule and terms.
- FR-042: Goods receipt shall record actual quantity, weighing evidence, batch code, source, delivery date and discrepancies.
- FR-043: Quality outcome shall be ACCEPT, ACCEPT_WITH_DEVIATION, QUARANTINE, REWORK or REJECT.
- FR-044: Inventory shall be tracked by product, batch, location, condition and quantity.
- FR-045: Stock reservation shall prevent double allocation and respect quality/expiry/availability status.
- FR-046: Stock adjustments require reason, actor, approval where threshold requires, and audit.
- FR-047: FIFO/FEFO allocation policy shall be configurable by product.
- FR-048: Inventory movements shall be immutable ledger events; current balance may be a transactionally maintained projection.

### Mill processing and traceability
- FR-050: Admin shall register/approve processing facilities, supported processes, users and stage templates.
- FR-051: Kirani shall create a processing job linked to source batch, PO/receipt and approved facility.
- FR-052: Mill user shall only access assigned facility jobs and permitted actions.
- FR-053: Mill shall scan/acknowledge assigned batch and record custody transfer.
- FR-054: Each stage shall record input batches/quantities, output batches/quantities, by-products, waste/loss, remaining quantity, unit/moisture adjustments, machine, operator, timestamps and QC.
- FR-055: Each output/by-product batch shall preserve all parent source genealogy.
- FR-056: Source batches shall not be merged unless explicit authorization and new combined batch genealogy are recorded.
- FR-057: Stage/job completion shall run mass-balance validation against configured tolerance.
- FR-058: Out-of-tolerance variance shall create an exception and block job completion or stock release pending authorized disposition.
- FR-059: Completed stage events shall not be edited; correction shall create linked adjustment events.
- FR-060: Kirani shall receive mill outputs, reconcile quantity and perform acceptance QC before saleable inventory release.

### Packing, QR, delivery and recall
- FR-070: Picking list shall allocate saleable batches to order lines using approved allocation policy.
- FR-071: Packing shall scan/validate item, quantity, batch and order allocation.
- FR-072: Every package shall have unique package ID and opaque public token; label stores product, pack size, pack date, batch allocation and QC state.
- FR-073: Public trace endpoint shall expose only approved disclosure fields and never private customer/farmer data.
- FR-074: System shall support package split/repack with parent/child genealogy and quantity reconciliation.
- FR-075: Delivery assignment shall associate orders/packages, operator, window and route/stop.
- FR-076: Delivery event shall record status, timestamp, actor, acknowledgement/OTP result and optional evidence.
- FR-077: Partial/failed delivery shall record item/quantity, reason, customer communication and resolution.
- FR-078: Recall shall identify affected source/derived batches, packages, orders, customers and remaining stock, and block further allocation/dispatch.

### Payments, finance and loyalty
- FR-080: Payment initiation shall use idempotency key and server-calculated amount.
- FR-081: Webhook signature and provider event identity shall be verified; duplicate callbacks shall not duplicate state changes.
- FR-082: Payment state shall be independent from order fulfilment state.
- FR-083: Refund shall support full/partial amount, reason, approval policy, provider reference and idempotency.
- FR-084: COD collection shall be recorded by order/package/operator and reconciled.
- FR-085: Farmer/supplier payable and payout shall be traceable to receipt/PO and approved deductions.
- FR-086: Loyalty policy shall be versioned with effective date, reward rates, conversion value and eligibility.
- FR-087: Every earning lot shall retain its original conversion value and expiry policy.
- FR-088: Redemption shall allocate points/value to specific earning lots; ledger is append-only.
- FR-089: Reversal of eligible refunded/cancelled purchases shall create linked negative/reversal entries.
- FR-090: Referral shall be direct-only, prevent self-referral and lock attribution according to configured rule.

### Notifications, support and reporting
- FR-100: Notification service shall support channel adapters, templates, preferences, delivery status and retry policy.
- FR-101: Campaigns shall support targeting, schedule, frequency caps, suppression, stop conditions and delivery logs.
- FR-102: Support ticket shall link to customer and optional order/item/package/payment, with priority, owner, status and resolution.
- FR-103: Admin dashboards shall show cycle, procurement, quality, inventory, processing, delivery and finance exceptions.
- FR-104: Reports shall be filterable by cycle/date, product, area, source, status and actor as applicable; exports must enforce authorization.

## 4. Core state models

### Monthly cycle
DRAFT → CONFIGURED → OPEN → CUTOFF_REACHED → PROCUREMENT_IN_PROGRESS → FULFILMENT → CLOSED. Admin may cancel a cycle with reason and explicit handling of confirmed orders.

### Customer monthly order
DRAFT → AWAITING_CONFIRMATION → CONFIRMED → PROCUREMENT_PLANNED → PARTIALLY_PROCURED/PROCURED → QUALITY_HOLD (when applicable) → PACKING → PACKED → READY_FOR_DISPATCH → DISPATCHED → OUT_FOR_DELIVERY → DELIVERED/PARTIALLY_DELIVERED. Cancellation/refund states are explicit and may coexist with fulfilment history.

### Listing
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED or CHANGES_REQUESTED/REJECTED. APPROVED may become SUSPENDED, EXPIRED or WITHDRAWN.

### Processing job
DRAFT → ASSIGNED → ACCEPTED → MATERIAL_RECEIVED → IN_PROGRESS → QC_PENDING → RECONCILIATION_PENDING (if needed) → COMPLETED → DISPATCHED_TO_KIRANI → RECEIVED_AND_INSPECTED. REJECTED/CANCELLED are terminal with reason.

### Payment
PENDING → INITIATED → AUTHORIZED → PAID; or FAILED. Refund lifecycle: REQUESTED → APPROVED → PROCESSING → PARTIALLY_REFUNDED/REFUNDED/FAILED. COD uses COLLECTION_PENDING → COLLECTED → RECONCILED.

Payment and order status must never be collapsed into one field.

## 5. Non-functional requirements
- NFR-001 Availability: pilot objective 99.5% monthly, excluding announced maintenance; confirm provider SLA.
- NFR-002 Performance: common read APIs p95 ≤ 500 ms and write APIs p95 ≤ 800 ms under agreed pilot load, excluding external provider latency; benchmark and tune.
- NFR-003 Scalability: modular monolith and indexed PostgreSQL schema support initial pilot and horizontal app/worker scaling.
- NFR-004 Accessibility: responsive mobile-first UX, keyboard support and clear validation/error messages.
- NFR-005 Localization: Kannada and English with locale-aware dates, numbers and currency.
- NFR-006 Reliability: background jobs retry safely; dead-letter/failed-job visibility; idempotent external actions.
- NFR-007 Observability: structured logs, correlation IDs, metrics, error reporting and alerts.
- NFR-008 Recovery: daily automated DB backup minimum; define RPO/RTO and demonstrate restore before pilot.
- NFR-009 Maintainability: versioned API, migration scripts, automated tests, architecture decisions and operational runbooks.
- NFR-010 Privacy: collect minimum data, restrict access, define retention/deletion and disclose location use.
- NFR-011 Data integrity: monetary, order, stock, payment and genealogy writes are transactional and constrained.
- NFR-012 Auditability: privileged business actions are attributable and tamper-evident/append-only.

## 6. Security requirements
- SEC-001 Passwords use a modern adaptive hash; secrets never committed to source control.
- SEC-002 Server-side RBAC and object-level authorization prevent IDOR/cross-customer/facility access.
- SEC-003 Admin MFA, login rate limiting, credential-stuffing protection and session revocation.
- SEC-004 Validate and normalize all input; parameterized SQL; output encoding; CSRF protections where cookie sessions used.
- SEC-005 Upload allowlist, MIME/content inspection, size limits, malware scanning where available, private storage and signed URLs.
- SEC-006 Encrypt transport; encrypt sensitive fields/storage where appropriate; redact logs.
- SEC-007 Verify payment webhook signatures and replay/idempotency.
- SEC-008 Rate-limit public trace and invitation endpoints; opaque unguessable public tokens.
- SEC-009 Audit role changes, pricing, payment/refund, stock, batch, QC, recall and policy actions.
- SEC-010 Restrict mill users to assigned facility/job; restrict farmer to own records; customer to own data.
- SEC-011 Backup access is restricted; restore tests and retention are documented.
- SEC-012 Public QR page never exposes PII, bank data or private documents.

## 7. Data and integration constraints
PostgreSQL is system of record. IDs are UUIDs; business codes are separate human-readable values. Money uses integer minor units; quantity uses NUMERIC with unit. All business records carry created_at/updated_at and actor where relevant. Immutable event/ledger tables are append-only. Files are stored in object storage; database stores metadata and access policy. External providers are behind adapters and their IDs/status payloads are persisted.

## 8. Error model
API errors use stable machine code, human-safe message, correlation ID and optional field errors. Never return stack traces, SQL, secrets or internal provider credentials. Distinguish validation, authentication, authorization, conflict/state-transition, rate limit, provider failure and unexpected server error. Retry only transient/idempotent operations.

## 9. Acceptance and verification
- Unit tests for pricing, cutoff, basket versioning, conversion lots, mass balance, permissions and state transitions.
- Integration tests for PostgreSQL transactions, payment webhooks, refunds, notifications and object storage.
- End-to-end tests for customer monthly cycle, procurement, mill processing, packing, delivery and reconciliation.
- Negative tests: expired invitation, wrong role, cross-customer ID, closed cutoff, duplicate callback, duplicate refund, invalid signature, batch cross-consumption, over-tolerance loss, quarantined allocation, stale stock, invalid QR token, unauthorized trace disclosure, double COD reconciliation.
- Restore test from backup; migration upgrade test; accessibility/localization checks; load test at agreed pilot concurrency.
- UAT sign-off by business, operations, quality, finance and engineering.
