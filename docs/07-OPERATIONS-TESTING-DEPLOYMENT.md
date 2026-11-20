# Kirani Phase 1 — Operations, Testing, Deployment and Handover

**Version:** 1.0 | **Status:** Proposed runbook baseline

## 1. Operating procedures

### 1.1 Monthly cycle setup
1. Admin creates cycle with start/end, cutoff timestamp, timezone, service areas, reminder plan and delivery windows.
2. Validate catalogue active status, pack sizes, price effective dates and available sourcing assumptions.
3. Publish cycle to eligible customers and send initial notification.
4. Monitor confirmation progress and notification failures.
5. At cutoff, run a deterministic close job: lock cycle, mark unconfirmed baskets NOT_CONFIRMED, prevent customer edits for that cycle, snapshot confirmed orders and produce demand aggregation.
6. Re-run is safe/idempotent; cycle closure is not duplicated.

### 1.2 Procurement and receipt
1. Review aggregated demand and approved safety buffer.
2. Compare farmer/supplier offers, landed costs, quality evidence and delivery dates.
3. Obtain approval under purchase authority matrix and issue PO.
4. Track supplier dispatch and expected arrival.
5. At receipt, scan/assign source batch code, weigh, record actual quantity and perform checklist inspection.
6. Accept, accept with deviation, quarantine, rework or reject; never make quarantined quantity saleable.
7. Reconcile PO quantity, received quantity, rejected quantity and outstanding quantity.
8. Create payable only for approved accepted quantity and terms.

### 1.3 Mill job procedure
1. Confirm facility approval, capability, job assignment and source batch status.
2. Create one job per source batch by default; attach process template/version and tolerance.
3. Dispatch material with custody record, weight, seal/QR and timestamp.
4. Mill operator scans assigned batch and acknowledges receipt; mismatch opens exception.
5. Operator records each stage start/completion, inputs, outputs, by-products, waste/loss, machine, operator, quality and evidence.
6. Server validates batch authorization, quantity availability, stage sequence and mass balance.
7. Out-of-tolerance result blocks completion pending Quality/Operations review.
8. Mill dispatches finished and by-product outputs with transfer record.
9. Kirani weighs, inspects and reconciles returned outputs before releasing saleable inventory.
10. Mill fee/payable is approved against completed job and measured output/contract terms.

### 1.4 Packing and delivery
1. Generate picking wave from confirmed orders and saleable available stock.
2. Allocate batches using configured FIFO/FEFO and customer/source separation policy.
3. Pick and scan item/batch/quantity; resolve shortage before packing.
4. Pack, weigh, inspect seal/label, generate unique package QR and allocate source batches.
5. Validate package allocation total equals net pack quantity.
6. Assign packages to order, delivery window, operator and route stop.
7. Operator scans package at handover; capture delivery outcome and acknowledgement.
8. Record COD against exact order; reconcile operator cash with finance.
9. Partial/failed delivery creates explicit exception and customer communication.

### 1.5 Recall procedure
1. Open recall against suspected source batch, derived batch, package, SKU or incident.
2. System traverses genealogy and package allocations to identify descendants, current stock, orders and customers.
3. Immediately block affected inventory and packages from reservation/dispatch.
4. Quality/Operations assigns severity, disposition and communication plan.
5. Notify affected customers through approved channels; record delivery/failure.
6. Quarantine/return/dispose/rework affected goods under documented approval.
7. Reconcile all affected quantities and close only after required actions are complete.
8. Preserve evidence and immutable event history.

## 2. Roles and approval matrix (configure per business authority)
| Action | Initiator | Approver / control |
|---|---|---|
| Customer/farmer/supplier activation | Admin reviewer | Authorized admin; audit |
| Seasonal listing approval | Quality/category reviewer | Admin approver |
| PO creation | Procurement | PO approval by limit |
| PO price/quantity variance | Procurement | Authorized buyer/manager |
| Stock adjustment | Inventory operator | Manager/Finance/Quality by threshold |
| Quality release after hold | Quality officer | Authorized quality approver |
| Mill out-of-tolerance variance | Mill submits | Kirani Quality/Operations |
| Refund | Support/Finance request | Finance approver by threshold |
| Loyalty manual adjustment | Support/Finance request | Separate authorized approver |
| Recall close | Quality lead | Business/quality owner |
| Role/permission change | Admin | Privileged admin with MFA and audit |

No user should approve their own sensitive request where maker-checker is required.

## 3. Test strategy

### Test layers
- Unit: pricing, taxes, cutoff, basket version selection, state machines, unit conversion, mass balance, lot conversion and allocation, authorization policy.
- Repository/integration: database constraints, transactions, locks, outbox, migrations, idempotency.
- Contract: OpenAPI request/response schemas, provider adapter contracts, webhook signature handling.
- End-to-end: complete monthly customer-to-delivery cycle and farmer-to-mill-to-package genealogy.
- Security: SAST/dependency checks, secret scan, authorization/IDOR, injection, XSS/CSRF, rate limit, upload and webhook replay.
- Performance: API p95, database contention, cycle close aggregation, trace traversal, export and worker throughput.
- Operational: backup restore, worker restart, provider outage, retry/dead-letter replay and incident recovery.
- UAT: customer, procurement, quality, mill, packing, delivery, finance and admin roles.

### Mandatory negative test cases
1. Expired/revoked/overused invitation cannot register.
2. Suspended customer cannot confirm order.
3. Customer A cannot read/update Customer B's basket/order/address/payment/ticket.
4. Farmer A cannot access Farmer B's listing, farm or payable.
5. Mill A cannot read/consume a batch/job assigned to Mill B.
6. Customer cannot edit a cycle after cutoff; unauthorized admin override fails.
7. One-time basket does not appear in next cycle.
8. Confirmed order snapshot does not change after recurring basket edit or catalogue price update.
9. Duplicate order confirmation does not create duplicate order.
10. Client-supplied amount cannot override server-calculated total.
11. Invalid/duplicate/replayed payment webhook does not create duplicate payment/refund.
12. Same idempotency key with different payload returns conflict.
13. Quarantined, expired or rejected stock cannot be allocated.
14. Concurrent packing cannot overdraw the same inventory batch.
15. Mill cannot consume more than assigned available quantity.
16. Processing output + by-products + waste/loss + remaining outside tolerance blocks release.
17. Genealogy cycle or unauthorized source merge is rejected.
18. Package allocations not equal to net package quantity are rejected.
19. Public QR token guessing/rate abuse is throttled; private source data is never exposed.
20. Recall blocks affected stock and identifies every descendant/package/order/customer.
21. Loyalty redemption cannot overspend points; old lots keep old conversion after policy change.
22. Self-referral and indirect referral reward are rejected.
23. COD cannot be collected/reconciled twice.
24. Upload rejects executable, mismatched MIME, oversized and unauthorized file types.
25. Unauthorized role cannot approve own refund/stock/PO/loyalty adjustment where maker-checker applies.

## 4. Deployment environments
- Local: seeded synthetic data, test payment provider, fake notification adapter.
- Development: shared integration environment; no production personal data.
- Staging/UAT: production-like configuration, separate credentials, payment sandbox and end-to-end test dataset.
- Production: restricted deploy access, managed secrets, backups, monitoring and change approval.

## 5. Deployment pipeline
1. Pull request runs formatting, lint, type-check, unit, integration, migration and security scans.
2. Build immutable artifact/container; generate SBOM and version metadata.
3. Deploy to staging; run migration compatibility checks and smoke tests.
4. Execute UAT and obtain sign-off for release.
5. Back up DB and verify backup age before production migration.
6. Apply backward-compatible migration; deploy API/worker; run health checks and smoke tests.
7. Monitor errors, payment webhooks, worker queue, DB and critical business metrics.
8. Roll back app artifact if needed; use forward-fix for irreversible migrations. Restore DB only under incident plan after assessing data loss.

## 6. Configuration and secrets
Environment configuration includes database URL, session/token secrets, encryption keys, payment provider credentials, webhook secrets, notification credentials, object storage credentials, allowed origins, public base URL, rate limits, timezone defaults and observability DSN. Store in hosting secret manager; never commit .env or real keys. Separate sandbox and production credentials. Rotate secrets and document owner/expiry.

## 7. Backup, recovery and continuity
- Minimum proposed baseline: automated daily PostgreSQL backup plus provider point-in-time recovery if affordable/available.
- Encrypt backups; restrict restore access; define retention with business/legal owner.
- Set RPO/RTO with business owner before production (pilot suggestion to discuss: RPO 24h, RTO 8h; improve if operational impact requires).
- Perform restore drill before pilot and at an agreed recurring cadence.
- Back up object storage metadata/content or use provider versioning/replication with tested restore.
- Document recovery order: DB → object storage access → secrets/config → API/worker → payment webhook replay/reconciliation → notifications.

## 8. Monitoring and alerting
Monitor:
- API availability, latency, error rate and auth anomalies.
- Database CPU/storage/connections/locks/slow queries and backup age.
- Worker lag, retries, dead-letter queue and scheduled job misses.
- Payment intent/webhook/refund failures and reconciliation mismatch.
- Notification provider failures and campaign backlog.
- Stock negative-balance attempts, allocation conflicts and expiry alerts.
- Mill jobs overdue, out-of-tolerance yield and unacknowledged custody transfer.
- Recall events, failed customer notifications and unresolved support tickets.
- COD outstanding and supplier payable ageing.

Alerts must include service, environment, correlation ID, safe entity reference, severity and runbook link; never include secrets/PII.

## 9. Release and change management
- Every release has version, changelog, migration list, test evidence, known issues, rollback/forward-fix plan and approver.
- Business policy changes (cutoff, price, tax, loyalty, sourcing claim, quality tolerance, disclosure) require effective date, version and audit.
- Use feature flags for incomplete/controlled rollout.
- No direct production DB edits; use reviewed migration or audited admin workflow.
- Production support uses least-privilege temporary access and audit.

## 10. Handover / KT checklist
- Product walkthrough for customer, farmer, supplier, mill, admin, quality, finance and delivery.
- Architecture, module ownership, deployment diagram and environment inventory.
- ERD, schema, migration order, seed data and backup/restore.
- API OpenAPI document, authentication, roles and error/correlation model.
- End-to-end cycle demo with source batch → mill stages → package QR trace.
- Payment webhook/refund/COD reconciliation walkthrough.
- Loyalty earning-lot and grandfathered conversion example.
- Quality hold, processing variance and recall drill.
- Dashboards, logs, alerts, failed job replay and incident escalation.
- Known risks, open decisions, vendor contacts and support ownership.
- Access handover and credential rotation; no secrets in KT documents.

## 11. Pilot go-live checklist
- Business BRD/SRS and unresolved decisions signed.
- Regulatory/licensing/tax/label review completed by qualified advisors.
- Service areas, cycle cutoff, delivery capacity and customer support coverage configured.
- Product, farmer/supplier, mill and quality masters approved.
- Price/tax/invoice rules tested.
- Payment sandbox/live verification and refund process tested.
- Notification templates/provider approvals complete.
- Full traceability and recall test passed.
- Inventory opening balance and reconciliation approved.
- Admin MFA, RBAC, audit and backups enabled.
- Restore drill, security negative tests and UAT signed.
- Incident contacts, runbooks and rollback plan available.
