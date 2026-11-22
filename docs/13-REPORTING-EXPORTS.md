# Kirani reporting and CSV export

The admin Reports workspace provides tenant-scoped operational, finance and traceability summaries plus downloadable CSV exports.

## Export types

- `operations`: order ID, delivery date, lifecycle/payment status and minor-unit totals.
- `finance`: payment ledger capture/refund entries, references and reasons.
- `traceability`: package, order, product, batch lot and allocated quantity.

Endpoint:

```
GET /api/v1/admin/reports/export?type=operations&from=2026-11-01&to=2026-11-22
```

The endpoint requires an admin bearer token. Date filters use ISO `YYYY-MM-DD`, are inclusive, and are limited to 366 days. Each export is capped at 20,000 rows. All queries are scoped to the authenticated tenant. CSV cells are quoted and spreadsheet formula-leading characters are neutralized.

Exports intentionally omit customer contact details, private delivery addresses and public trace tokens. Reconcile finance exports against the payment ledger and external provider statements before treating totals as collected or settled cash.
