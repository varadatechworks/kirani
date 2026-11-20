# Kirani — Phase 1 Product & Engineering Documentation

**Document baseline:** 1.0  
**Status:** Draft for stakeholder review and implementation baseline  
**Scope:** Invite-only monthly grocery procurement, processing, traceability and delivery platform  
**Repository:** https://github.com/varadatechworks/kirani

## Purpose

This repository contains the business requirements, software requirements, architecture, data design, diagrams, API contracts, operational workflows and delivery guidance for Kirani Phase 1. It is the source of truth for implementation and acceptance.

## Documentation index

| Document | Description |
|---|---|
| [BRD — Business Requirements](docs/01-BRD.md) | Business model, actors, scope, policies, workflows, rules, reports and acceptance outcomes |
| [SRS — Software Requirements](docs/02-SRS.md) | Functional requirements, quality attributes, permissions, validations and testable acceptance criteria |
| [Architecture](docs/03-ARCHITECTURE.md) | Logical/physical architecture, module boundaries, deployment topology, integrations and security |
| [Database Design](docs/04-DATABASE-DESIGN.md) | PostgreSQL conventions, entities, relationships, constraints, indexes, transaction boundaries and migration guidance |
| [ER Diagrams](docs/05-ER-DIAGRAMS.md) | Mermaid ER diagrams for commerce, procurement, processing genealogy, loyalty and platform controls |
| [API Specification](docs/06-API-SPECIFICATION.md) | Versioned REST resource map, representative request/response contracts, idempotency and error model |
| [Operations & Delivery](docs/07-OPERATIONS-TESTING-DEPLOYMENT.md) | End-to-end operating procedures, security, testing, deployment, backup/restore, monitoring and KT checklist |
| [Decision Log](docs/08-DECISIONS-AND-OPEN-ITEMS.md) | Confirmed policy decisions, assumptions and unresolved launch decisions |

## Product summary

Kirani is an invite-only grocery service. Customers maintain a recurring monthly grocery template and can add cycle-specific one-time items. Each customer explicitly confirms a monthly order before the configured cutoff. Kirani aggregates demand, procures raw or finished goods from approved farmers/suppliers, may send raw agricultural materials through approved mills for controlled multi-stage processing, inspects and packs saleable goods, and delivers them in a scheduled monthly window.

The product differentiators are trustworthy source transparency, batch-level genealogy, disciplined quality controls and predictable monthly fulfilment. Product claims must distinguish farmer/supplier declarations from independently verified facts and certifications.

## Phase 1 principles

1. No customer-visible farmer seasonal listing before Kirani Admin approval.
2. No procurement demand from an unconfirmed customer basket unless a separately approved standing-order policy is introduced.
3. Recurring basket edits apply to the next eligible cycle; a confirmed order is an immutable snapshot.
4. One-time basket lines belong to one monthly cycle and never silently recur.
5. Keep source batches separate through receiving, storage, processing and packing by default.
6. Any approved merge creates a new batch with full input genealogy, quantities and reconciliation.
7. Every processing stage records inputs, outputs, by-products, waste/loss, operator, facility, time and quality outcome.
8. Payment state and fulfilment state are independent.
9. Loyalty points are immutable earning lots with grandfathered conversion value.
10. Corrections to completed traceability or financial events are compensating, audited events—not silent edits.
11. No silent substitutions, price increases or partial fulfilment outside customer-approved rules.
12. Use a modular monolith initially; keep module boundaries explicit and avoid premature microservices.

## Baseline technology direction

- Backend: TypeScript, modular monolith, REST API under `/api/v1`.
- Database: PostgreSQL; relational integrity for orders, money, inventory and genealogy.
- Portals: responsive customer, farmer/supplier, Kirani operations/admin and restricted mill operator interfaces.
- Customer mobile experience: responsive web/PWA first unless native app requirements justify a shared cross-platform app.
- Integrations: payment gateway adapter, notification providers, object storage, QR/barcode generation and background job runner.
- Deployment: low-cost managed hosting for pilot, with managed PostgreSQL, automated backups and an upgrade path.

Exact providers, hosting region, payment gateway, notification vendor and mobile packaging choice are deployment decisions and must be confirmed before production.

## Document governance

- Requirements use stable identifiers: BR, FR, NFR, SEC, DATA, API and AC.
- Any change to cutoff, pricing, basket commitment, traceability, loyalty conversion, refund or fulfilment policy requires a recorded decision and impact review.
- Database migrations are forward-only in shared environments; destructive changes require an approved migration plan and backup.
- All diagrams are maintained as Mermaid source in Markdown so they remain reviewable and version-controlled.
- “Verified” must mean evidence has been reviewed under an explicitly defined verification process. A declaration is not verification.
- This pack is a design baseline, not evidence that software, regulatory approvals, integrations or operational controls have already been implemented.

## Suggested review sequence

1. Business owner approves BRD and open decisions.
2. Product/operations owner signs off SRS workflows and acceptance criteria.
3. Engineering reviews architecture, data model and API contracts.
4. Finance/quality/compliance owners validate their respective rules.
5. Implementation begins only after the blocking decisions in [Decision Log](docs/08-DECISIONS-AND-OPEN-ITEMS.md) are resolved or explicitly accepted as configurable assumptions.
