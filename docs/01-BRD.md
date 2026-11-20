# Kirani Phase 1 — Business Requirements Document (BRD)

**Version:** 1.0 | **Status:** Draft for business sign-off | **Baseline:** 20 November 2026

## 1. Executive summary
Kirani is an invite-only monthly grocery procurement and fulfilment service. Customers maintain a recurring grocery template, may add cycle-specific one-time items, and explicitly confirm a monthly order before cutoff. Kirani aggregates confirmed demand, procures raw or finished goods from approved farmers/suppliers, coordinates controlled milling/processing where needed, inspects and packs goods with source genealogy, and delivers in scheduled windows. The differentiator is credible product/source transparency and disciplined quality and fulfilment—not unsubstantiated “organic” claims.

## 2. Objectives and measures
- Reliable monthly grocery supply for an approved customer network.
- Traceable source identity through procurement, processing, packing and delivery.
- Predictable farmer/supplier procurement and fair, auditable settlement.
- Fewer quality, stock, payment and delivery exceptions.
- Extensible operating foundation for new areas and products.

Pilot KPIs: cycle confirmation rate; on-time delivery; line fill rate; procurement plan/actual variance; quality rejection; processing yield and unexplained loss; traceability completeness; payment/refund/COD reconciliation; complaint resolution; supplier performance; contribution margin by SKU/order. Set numerical targets after pilot baselining.

## 3. Scope

### In scope — Phase 1
1. Invitation-only onboarding, mobile verification, profiles, addresses and service-area checks.
2. Catalogue, categories, SKU/pack sizes, price and availability.
3. Versioned recurring monthly basket and cycle-specific one-time additional basket.
4. Configurable cycles, cutoff, reminders, preview and explicit confirmation.
5. Demand aggregation and procurement planning.
6. Farmer/supplier onboarding, verification, availability and declarations.
7. Admin-approved farmer seasonal listings and targeted announcements.
8. Customer product requests, demand aggregation and sourcing opportunities.
9. Quotations, purchase orders, goods receipt, quality inspection and payables.
10. Approved mill/facility portal, configurable multi-stage processing jobs and genealogy.
11. Inventory, batch reconciliation, quality holds and recall.
12. Picking, packing, package IDs, QR labels and customer trace page.
13. Scheduled delivery, proof of delivery, partial/failed delivery and COD.
14. Online payments, refunds, reconciliation, invoices/receipts.
15. Direct referral and purchase rewards with immutable earning lots.
16. Notifications, customer support, feedback, admin dashboards and reports.
17. RBAC, admin MFA, audit, backups, monitoring, localization and operating documentation.

### Out of scope
Public open marketplace; instant/on-demand delivery; multi-level referral; wallet transfers; farmer auctions; AI forecasting/crop advisory; automated route optimization; franchise/multi-tenant management; subscription tiers; automatic certification; complex ERP integration unless selected as a launch dependency.

## 4. Actors
Customer; Farmer; Supplier; Kirani Admin; Procurement Officer; Quality Officer; Inventory/Packing Operator; Mill Manager/Operator; Delivery Operator; Finance Officer; Support Agent; System Administrator. Roles are permissions, not job titles. Users may hold multiple approved roles subject to separation-of-duties controls.

## 5. Monthly business cycle
1. Admin configures cycle, cutoff, timezone and delivery windows.
2. Customer maintains recurring template and optional one-time additions.
3. Customer reviews consolidated items, quantities, estimated price and delivery window; explicitly confirms.
4. At cutoff, unconfirmed baskets are excluded from procurement by default.
5. Confirmed demand aggregates by SKU, quantity, area and required date.
6. Procurement selects approved offers and issues purchase orders.
7. Goods are received, weighed, inspected and accepted/quarantined/rejected.
8. Raw goods requiring conversion are processed at approved mills under source-specific jobs.
9. Kirani reconciles, inspects and releases finished stock.
10. Operators pick, pack and create package QR identities linked to batches.
11. Delivery operator delivers in scheduled window and records acknowledgement/COD.
12. Finance reconciles gateway payments, refunds, COD, supplier payables and expenses.

## 6. Customer, access and baskets
- Registration requires valid invitation or explicit admin approval; verify mobile before activation.
- Referral must not bypass invitation policy. Admin can suspend/reactivate with reason and audit.
- Only active customers in serviceable areas can confirm.
- Recurring basket is a continuing template with versions. Edits before cutoff apply to the next eligible cycle, not an already confirmed cycle.
- One-time basket is attached to exactly one cycle and never carries forward.
- Both baskets consolidate into one monthly order, payment/invoice and delivery. Every order line preserves basket type (RECURRING/ONE_TIME), source basket/version and effective cycle.
- Saved basket is not a commitment. Confirmation creates an immutable order snapshot.
- After cutoff, customer edits for that cycle are blocked. Admin exceptions require authorization, reason, before/after values and customer communication.
- A confirmed order is never silently mutated; use an audited amendment/cancellation workflow.

## 7. Substitution, shortage and price
No silent substitutions or price increases. Customer preference is one of: no substitution; ask me; allow only preselected alternatives. Record shortage per line and quantity. Customer chooses approved alternative, partial fulfilment or refund unless a prior explicit preference covers it. Price changes after confirmation require customer consent. Confirmed price and quantity remain the order snapshot.

## 8. Farmer, supplier and product discovery
- Capture identity, contact, farm/location, documents, payment details and verification status; restrict sensitive data.
- Listing records product/variety, source farm, harvest/availability, quantity, price/unit, production declarations, storage, readiness and evidence.
- Seasonal listing lifecycle: draft, submitted, review, changes requested, approved, rejected, suspended, expired, withdrawn. No customer visibility before admin approval.
- Material changes to source, price or declarations may require reapproval.
- Admin campaigns target service area, category interest, purchase history, requesters and notification opt-ins. Schedule one-time/daily/weekly/custom/off; stop on expiry, exhaustion, withdrawal, suspension, end date or manual stop; apply frequency caps.
- Farmer response to a sourcing opportunity is an offer/availability response, not a purchase commitment.
- Customer request flow: submit → admin review/clarify/approve/reject/merge demand → publish sourcing opportunity → farmer/supplier responses → Kirani evaluates → authorized PO → receive/verify/catalogue → notify requesters. Preserve individual requests even when demand is aggregated.

## 9. Procurement, mill processing and source genealogy
- Purchase orders specify source, SKU/raw material, quantity/unit, agreed price, quality criteria, schedule and terms. Track partial receipt, variance, rejection and landed-cost components (material, transport, mill, handling, packaging, testing and wastage).
- Keep separate identities for Product SKU, Source/Procurement Batch, Processing Batch/Stage Output and Package Unit.
- Source batches remain separate by default through storage, processing and packing. Any authorized merge creates a new batch and records all inputs, source proportions, outputs and loss.
- Mill is an approved controlled facility with restricted portal access. Create a processing job per source batch unless a merge is explicitly approved.
- Mill scans assigned batch and records configured stages: facility, machine/workstation, operator, start/end, input/output quantity, by-products, waste/loss, moisture/unit adjustment, QC and evidence.
- Each output and by-product receives its own batch identity and disposition. No unrelated batch may be consumed without authorization.
- Record equipment cleaning/changeover where required by risk assessment. Excess variance beyond configured tolerance blocks completion/release.
- Example paddy flow: 100 kg farmer source batch → cleaning → dehusking → grading → polishing → final rice. Quantities and by-products are measured, not assumed; sample yields in examples are illustrative only.
- Stage mass balance: input = saleable outputs + recoverable by-products + waste/loss + remaining quantity ± documented process adjustment. Units and moisture basis are explicit.
- Completed records are immutable; correction uses an audited compensating event.

## 10. Quality, inventory and recall
- Checkpoints: receipt, configured processing stages, mill return, finished goods, packing and dispatch.
- SKU/process-specific checklist records measurement, unit, method, range, result, inspector, timestamp and evidence.
- Outcomes: accept, accept with approved deviation, quarantine, rework or reject. Quarantined/rejected stock cannot be reserved or dispatched.
- Track inventory by location, product, batch, condition and quantity. Support FIFO/FEFO as configured, expiry/best-before and storage conditions where relevant.
- Stock adjustment requires reason, actor and approval threshold.
- Recall by source, derived batch, package, product or incident identifies descendants, packages, orders, customers and remaining stock; blocks allocation/dispatch and records notifications/disposition.

## 11. Package QR and transparency
Each package has unique internal ID and opaque public token. QR page may expose approved product, pack size, batch reference, source summary (subject to consent/disclosure), safe-granularity region, procurement/packing dates, processing summary, QC status, declarations and verified certifications. Never expose private phone, bank, personal documents or sensitive exact location. Clearly label farmer/supplier declarations separately from independently verified evidence.

## 12. Payments, finance and loyalty
- Online gateway and COD via provider adapters. Payment lifecycle is independent of fulfilment lifecycle.
- Verify gateway signatures; idempotently process callbacks/refunds; never trust client payment success.
- Record full/partial refunds, reason, method, provider reference and status. Reconcile COD by operator/route/order.
- Baseline configurable purchase reward 5% of eligible purchase value; direct referral reward 2% of referred customer's eligible purchase value; no indirect rewards.
- Points earning and point-to-currency conversion are separate versioned policies.
- Each earning lot stores conversion effective when earned; existing lots retain that value after policy changes. Redemption identifies consumed lots (earliest-expiring eligible first recommended).
- One direct referrer; self-referral blocked; reward after qualifying purchase; cancelled/refunded purchase reverses linked rewards.
- Track farmer/supplier payables, landed cost, tax/invoice configuration, expenses, refunds, COD, gateway reconciliation and loyalty liability.

## 13. Delivery, support and experience
- Configure delivery windows by cycle/area; assign route, stops, operator and packages.
- Delivery proof: status, timestamp, operator, customer acknowledgement/OTP and optional evidence.
- Distinguish delivered, partial, refused, customer unavailable, damaged and failed; record reason and next action.
- Customer sees order status/history, invoice, package QR, support ticket and feedback.
- Support ticket links to order/item/package/payment and tracks priority, owner, status, resolution and communication.
- Kannada and English initially; localization-ready architecture.

## 14. Admin governance and reporting
RBAC/least privilege, admin MFA, maker-checker for defined financial/stock/policy actions, immutable audit trail for orders/prices/procurement/inventory/genealogy/quality/payments/refunds/loyalty/access. Policies are versioned with effective dates.

Reports: cycle confirmation; demand split by basket type; procurement plan/actual and quote comparison; landed cost; supplier performance/payables; mill stage yield/loss/by-product/variance; inventory ageing/movement/reservations/holds; package/source allocation; recall impact; delivery SLA/failure/COD; sales/tax/refund/loyalty liability/contribution; product requests/sourcing/campaign performance.

## 15. Business rules
| ID | Rule |
|---|---|
| BR-001 | Access is invitation-only or admin-approved. |
| BR-002 | Only active customers in serviceable areas may order. |
| BR-003 | Saved recurring basket is not an order commitment. |
| BR-004 | Unconfirmed basket is excluded from procurement by default. |
| BR-005 | Recurring edits apply to next eligible cycle. |
| BR-006 | One-time lines belong to one cycle and never recur. |
| BR-007 | Confirmed order snapshot is immutable. |
| BR-008 | Farmer seasonal listings require admin approval. |
| BR-009 | Farmer sourcing response is not a purchase order. |
| BR-010 | Source batches stay separate unless approved genealogy-preserving merge. |
| BR-011 | Every processing stage records inputs, outputs, by-products, loss and actor/time. |
| BR-012 | Variance beyond tolerance blocks release pending review. |
| BR-013 | Quarantined/rejected stock cannot be allocated or dispatched. |
| BR-014 | Public QR exposes approved non-sensitive trace data only. |
| BR-015 | Payment and fulfilment states are independent. |
| BR-016 | Price increases/substitutions require consent. |
| BR-017 | Historical loyalty conversion is grandfathered per earning lot. |
| BR-018 | Referral is direct-only; qualifying reversals reverse rewards. |
| BR-019 | Historical events are corrected by compensating events, not silent edits. |
| BR-020 | Recall blocks affected stock and identifies descendants/customers. |

## 16. Acceptance outcomes
Pilot readiness requires end-to-end demonstration of: invitation and serviceability; recurring plus one-time basket; explicit confirmation and cutoff exclusion; aggregated demand; admin-approved farmer sourcing and PO; raw batch receipt/QC; multi-stage mill job with child genealogy/by-products/mass balance; finished stock release; source-specific package QR; delivery proof; online/COD reconciliation; shortage/refund/recall/quality-hold scenarios; grandfathered loyalty conversion; role enforcement/audit; backup restoration and security negative tests.

## 17. Assumptions and compliance dependencies
Kirani must obtain qualified advice on applicable food-business licensing/FSSAI, Legal Metrology, GST/tax, consumer protection, privacy, labour and transport obligations before launch. Product claims/certifications require evidence and review. Service areas, cutoff, delivery calendar, payment/notification providers, hosting region, retention, RPO/RTO and service targets require sign-off. This document is a design baseline, not evidence that regulatory approvals or software controls are already implemented.
