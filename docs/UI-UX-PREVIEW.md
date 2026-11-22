# Kirani UI and API integration notes

## Shared design

- Botanical green and warm ivory visual system.
- Responsive admin workspace and mobile-first customer/farmer experiences.
- Consistent status chips, tables, cards and concise user-facing errors.

## Live API wiring in this phase

The UI has a Connect API action. It accepts a short-lived bearer access token from the configured identity provider and keeps it in JavaScript memory only. It does not persist credentials in browser storage.

- Admin overview reads tenant-scoped dashboard metrics.
- Admin catalogue reads products and can create products with server-side validation.
- Admin cycle management creates draft cycles and opens/closes cycles through audited API calls.
- Admin farmer sourcing view reads submitted listings and allows approval/rejection with a mandatory reason.
- Customer mobile view reads the active cycle and catalogue, loads the recurring basket and saves a new basket version.
- Farmer mobile view reads own listings and submits new availability for admin review.
- Order screens read order history; order confirmation and payment are not implemented.

## Data safety

The browser is not authoritative for prices, roles, tenant IDs or status transitions. The API resolves user and tenant from a signed token and active PostgreSQL user/role membership. All list and detail queries are tenant-scoped; customer order reads are owner-scoped. Farmer listings only become approved through an admin endpoint. The API returns stable errors with correlation IDs.

## Demo and incomplete areas

When no access token is connected, the original visual preview data remains visible and is not real operational data. Payments, refunds, delivery, procurement, mill processing, batch genealogy, package QR trace, loyalty, notifications, recall and full order confirmation remain future implementation work. Do not use the preview dataset for operational decisions.
