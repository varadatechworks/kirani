# Kirani Phase 1 — Decision Log and Open Items

**Version:** 1.0 | **Status:** Baseline decisions captured; pending items require owner sign-off

## 1. Confirmed business decisions

| ID | Decision | Implementation consequence |
|---|---|---|
| DEC-001 | Farmer seasonal listing is submitted by farmer, reviewed/approved by Kirani Admin, then published. | Listing approval/version lifecycle; no public visibility while pending. |
| DEC-002 | Keep different farmer/supplier source batches separate by default through receiving, processing and packing. | Separate processing jobs and stock; no routine mixing. |
| DEC-003 | If exceptional merge is authorized, create a new batch and preserve all source genealogy, quantities and allocations. | Many-to-many genealogy, approval, mass balance and audit. |
| DEC-004 | Existing loyalty earning lots retain the conversion value effective when earned. | Store conversion snapshot on each lot; never recompute old balance using latest policy. |
| DEC-005 | Recurring basket changes made before cutoff apply to the next eligible cycle, not a confirmed/current scheduled cycle. | Versioned basket and effective cycle; immutable order snapshot. |
| DEC-006 | Customer may add one-time items to a specific upcoming monthly cycle and receive them in the same delivery. | Separate one-time basket and order line basket_type; never copy forward. |
| DEC-007 | Raw agricultural materials may be processed at mills through multiple stages; source identity is retained at every stage/output/by-product/package. | Processing facility portal, stage events, child batches and genealogy. |
| DEC-008 | Farmers may propose seasonal products; Admin approval precedes customer visibility. | Farmer listings and targeted Farm Specials campaigns. |
| DEC-009 | Customers may request unavailable products; Kirani reviews and may publish sourcing opportunities. | Request → demand aggregation → sourcing response → Kirani PO workflow. |
| DEC-010 | Farmer/supplier response is not a purchase commitment. | Only authorized Kirani PO creates procurement commitment. |
| DEC-011 | Purchase and direct referral rewards are separate; no multi-level referral. | Separate earning event types and one direct referrer. |
| DEC-012 | Payment and fulfilment status are independent. | Separate state machines and ledgers. |
| DEC-013 | No silent substitution or price increase after customer confirmation. | Customer consent/amendment workflow. |
| DEC-014 | Use modular monolith initially, with explicit module boundaries. | One deployable API and worker, PostgreSQL system of record. |

## 2. Recommended defaults requiring owner confirmation

These defaults are documented to make implementation planning possible; they are not represented as final user approvals.

| ID | Topic | Recommended default | Why it matters |
|---|---|---|---|
| OPEN-001 | Unconfirmed basket | Exclude from procurement; mark NOT_CONFIRMED. No standing order in Phase 1. | Avoids buying stock without customer commitment. |
| OPEN-002 | Shortage handling | Ask customer; allow saved preference for partial delivery/refund or preselected alternative. | Avoids silent fulfilment changes. |
| OPEN-003 | Confirmed price | Freeze confirmed price/tax snapshot; any increase requires customer consent. | Prevents surprise charges and disputes. |
| OPEN-004 | Cutoff | Admin-configurable date/time per cycle/service area; publish before cycle opens. | Different delivery regions may need different lead times. |
| OPEN-005 | Delivery window | Customer selects from capacity-controlled windows; admin can assign when only one window is available. | Prevents overbooking. |
| OPEN-006 | Customer interface | Responsive mobile-first web/PWA for pilot unless native offline/device capability is a confirmed need. | Lowest initial operational cost. |
| OPEN-007 | Loyalty redemption | Earliest-expiring eligible earning lots first; minimum/max redemption configurable. | Deterministic and fair allocation. |
| OPEN-008 | Reward accrual | Earn after eligible order is delivered and payment settled; reverse on refund/cancellation. | Avoids rewards on unpaid/undelivered orders. |
| OPEN-009 | Mill job granularity | One source batch per job by default. | Simplifies segregation and genealogy. |
| OPEN-010 | Package disclosure | Farmer/source name only with explicit disclosure permission; otherwise show approved region/source reference. | Protects farmer privacy while preserving traceability. |
| OPEN-011 | Quality release | Only authorized Quality role releases quarantine/finished goods. | Separation of duties. |
| OPEN-012 | Inventory costing | Track actual landed cost per source/processing batch; define weighted/lot costing policy with Finance. | Enables credible margin and valuation. |
| OPEN-013 | Tax/invoice | Configure after CA/legal review; never hardcode assumed tax rates. | Tax applicability depends on entity, goods and transaction. |
| OPEN-014 | Backup recovery | Daily backup minimum; define RPO/RTO (initial discussion baseline RPO 24h/RTO 8h). | Business continuity requirement. |
| OPEN-015 | Notification channels | Start with approved email/SMS/WhatsApp provider(s); channel fallback and consent rules required. | Provider cost/template approval can affect launch. |

## 3. Decisions to close before production

### Business and fulfilment
- [ ] Confirm whether unconfirmed baskets are always excluded (recommended) or a standing-order opt-in is required.
- [ ] Approve shortage/partial fulfilment and substitution policy.
- [ ] Approve price lock, taxes, delivery fee and refund rules.
- [ ] Define monthly cutoff, reminders, cycle timezone and late-order exception authority.
- [ ] Define delivery capacity, failed delivery, return and reattempt rules.
- [ ] Define minimum order value/quantity and serviceable pincode/village list.

### Procurement, processing and quality
- [ ] Approve procurement authority limits and quotation policy.
- [ ] Define accepted/rejected/conditional receipt rules and supplier deductions.
- [ ] Approve product/process stage templates and measurable tolerances.
- [ ] Define moisture basis and unit conversion rules for grain processing.
- [ ] Define by-product ownership, sale/disposal and accounting.
- [ ] Define mill fee model, custody/insurance responsibility and liability for loss.
- [ ] Define quality checklists, sampling frequency, laboratory needs and evidence retention.
- [ ] Define source disclosure consent and farmer privacy level.

### Finance and compliance
- [ ] Select payment gateway and COD collection/reconciliation process.
- [ ] Confirm legal entity, bank settlement and supplier payout workflow.
- [ ] Obtain professional review of FSSAI/food business, Legal Metrology, GST/tax, consumer protection, privacy and labelling obligations.
- [ ] Define invoice numbering, credit notes, refund timelines and accounting export.
- [ ] Confirm loyalty tax/accounting treatment and redemption terms.

### Technology and operations
- [ ] Select hosting region/provider, PostgreSQL plan and object storage.
- [ ] Decide PWA/web versus native customer app and offline requirements for mill/delivery.
- [ ] Select SMS/WhatsApp/email provider and template approval owner.
- [ ] Define RPO/RTO, retention, availability target and support hours.
- [ ] Confirm language translations and customer support escalation.
- [ ] Define data migration/opening inventory plan and production access approvers.

## 4. Decision governance
Every decision record should contain: ID, status (proposed/approved/rejected/superseded), decision statement, owner, approver, effective date, rationale, impacted requirements/schema/API/tests and change history. Changes to cutoff, price, tax, loyalty conversion, source mixing, processing tolerance, public source disclosure, payment/refund or fulfilment rules require explicit impact review.

## 5. Current baseline caveat
This documentation set is a proposed design baseline. It does not assert that the open items have been approved, that the software has been implemented, or that regulatory compliance has been independently verified. The business owner must sign the BRD and decision log before production implementation.
