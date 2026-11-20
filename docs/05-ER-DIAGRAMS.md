# Kirani Phase 1 — Entity Relationship Diagrams

Diagrams are logical. Full columns, constraints and indexes are in [Database Design](04-DATABASE-DESIGN.md). Mermaid source is maintained here so changes can be reviewed in Git.

## 1. Customer, baskets, cycle and orders

```mermaid
erDiagram
  USERS ||--o| CUSTOMER_PROFILES : has
  USERS ||--o{ CUSTOMER_ADDRESSES : owns
  CUSTOMER_PROFILES ||--o{ RECURRING_BASKETS : maintains
  RECURRING_BASKETS ||--|{ RECURRING_BASKET_VERSIONS : versions
  RECURRING_BASKET_VERSIONS ||--|{ RECURRING_BASKET_ITEMS : contains
  CUSTOMER_PROFILES ||--o{ ONE_TIME_BASKETS : adds
  MONTHLY_CYCLES ||--o{ ONE_TIME_BASKETS : scopes
  ONE_TIME_BASKETS ||--|{ ONE_TIME_BASKET_ITEMS : contains
  MONTHLY_CYCLES ||--o{ MONTHLY_ORDERS : schedules
  CUSTOMER_PROFILES ||--o{ MONTHLY_ORDERS : confirms
  MONTHLY_ORDERS ||--|{ ORDER_ITEMS : contains
  MONTHLY_ORDERS ||--|| ORDER_SNAPSHOTS : freezes
  ORDER_ITEMS }o--o| RECURRING_BASKET_VERSIONS : sourced_from
  ORDER_ITEMS }o--o| ONE_TIME_BASKETS : sourced_from
  MONTHLY_ORDERS ||--o{ DELIVERY_ASSIGNMENTS : fulfils
  DELIVERY_ASSIGNMENTS ||--o{ DELIVERY_EVENTS : records
```

**Important:** recurring and one-time items are separate before confirmation but consolidate into a single monthly order. Order lines retain basket_type and source version; the snapshot freezes customer-confirmed commercial terms.

## 2. Farmer/supplier sourcing and procurement

```mermaid
erDiagram
  USERS ||--o| FARMER_PROFILES : represents
  USERS ||--o| SUPPLIER_PROFILES : represents
  FARMER_PROFILES ||--o{ FARMER_FARMS : operates
  FARMER_FARMS ||--o{ FARMER_PRODUCTS : produces
  PRODUCTS ||--o{ FARMER_PRODUCTS : listed_as
  FARMER_PRODUCTS ||--o{ FARMER_LISTINGS : offers
  FARMER_LISTINGS ||--o{ LISTING_APPROVALS : reviewed_by
  CUSTOMER_PRODUCT_REQUESTS ||--|{ CUSTOMER_PRODUCT_REQUEST_ITEMS : contains
  CUSTOMER_PRODUCT_REQUEST_ITEMS }o--o| PRODUCT_DEMAND_AGGREGATIONS : aggregated_into
  PRODUCT_DEMAND_AGGREGATIONS ||--o{ SOURCING_OPPORTUNITIES : sourced_by
  SOURCING_OPPORTUNITIES ||--o{ FARMER_SOURCING_RESPONSES : receives
  SOURCING_OPPORTUNITIES ||--o{ SUPPLIER_SOURCING_RESPONSES : receives
  FARMER_PROFILES ||--o{ FARMER_SOURCING_RESPONSES : responds
  SUPPLIER_PROFILES ||--o{ SUPPLIER_SOURCING_RESPONSES : responds
  PURCHASE_ORDERS ||--|{ PURCHASE_ORDER_ITEMS : contains
  PURCHASE_ORDERS ||--o{ GOODS_RECEIPTS : fulfilled_by
  GOODS_RECEIPTS ||--|{ GOODS_RECEIPT_ITEMS : contains
  GOODS_RECEIPT_ITEMS ||--o{ SOURCE_BATCHES : creates
```

A sourcing response is not a purchase order. Only an authorized Kirani buyer creates a PO. Preserve the original individual customer requests when aggregating demand.

## 3. Mill processing and source genealogy

```mermaid
erDiagram
  PROCESSING_FACILITIES ||--o{ PROCESSING_JOBS : performs
  SOURCE_BATCHES ||--o{ PROCESSING_JOBS : source_for
  PROCESSING_STAGE_TEMPLATES ||--|{ PROCESSING_STAGE_DEFINITIONS : defines
  PROCESSING_JOBS ||--|{ PROCESSING_JOB_STAGES : contains
  PROCESSING_STAGE_DEFINITIONS ||--o{ PROCESSING_JOB_STAGES : instantiated_as
  PROCESSING_JOB_STAGES ||--o{ PROCESSING_STAGE_EVENTS : records
  PROCESSING_STAGE_EVENTS ||--o{ PROCESSING_STAGE_OUTPUTS : produces
  PROCESSING_STAGE_OUTPUTS }o--|| INVENTORY_BATCHES : creates
  PROCESSING_JOB_INPUTS }o--|| INVENTORY_BATCHES : consumes
  INVENTORY_BATCHES ||--o{ BATCH_GENEALOGY : parent
  INVENTORY_BATCHES ||--o{ BATCH_GENEALOGY : child
  PROCESSING_STAGE_EVENTS ||--o{ PROCESSING_QUALITY_CHECKS : checked_by
  PROCESSING_JOBS ||--o{ BATCH_QUANTITY_RECONCILIATIONS : reconciled_by
  PROCESSING_JOBS ||--o{ PROCESSING_TRANSFERS : custody
  INVENTORY_BATCHES ||--o{ INVENTORY_MOVEMENTS : moved_by
```

Genealogy is a directed acyclic graph. A child output batch can have multiple parent inputs only for an explicitly authorized merge. The default is source-specific processing jobs. Stage output types distinguish saleable output, recoverable by-product, waste and reject.

## 4. Inventory, packages, QR and recall

```mermaid
erDiagram
  PRODUCTS ||--o{ INVENTORY_BATCHES : stocked_as
  INVENTORY_LOCATIONS ||--o{ INVENTORY_BATCHES : stores
  INVENTORY_BATCHES ||--o{ INVENTORY_MOVEMENTS : movement_history
  INVENTORY_BATCHES ||--o{ BATCH_INSPECTIONS : inspected
  PRODUCTS ||--o{ PACKAGE_UNITS : packaged_as
  PACKAGE_UNITS ||--|{ PACKAGE_SOURCE_ALLOCATIONS : derived_from
  INVENTORY_BATCHES ||--o{ PACKAGE_SOURCE_ALLOCATIONS : allocated_from
  SOURCE_BATCHES ||--o{ PACKAGE_SOURCE_ALLOCATIONS : traced_to
  PACKAGE_UNITS ||--o{ PACKAGE_LABELS : labelled
  PACKAGE_UNITS ||--o{ PACKAGE_STATUS_HISTORY : status_history
  ORDER_ITEMS ||--o{ CUSTOMER_PACKAGE_ALLOCATIONS : fulfilled_by
  PACKAGE_UNITS ||--o{ CUSTOMER_PACKAGE_ALLOCATIONS : allocated_to
  RECALL_CASES ||--o{ RECALL_AFFECTED_PACKAGES : affects
  PACKAGE_UNITS ||--o{ RECALL_AFFECTED_PACKAGES : recalled
  INVENTORY_BATCHES ||--o{ TRACEABILITY_EVENTS : event_stream
```

Package-source allocation must reconcile to package net quantity. QR token resolves a curated public view; it does not expose raw database entities or sensitive records.

## 5. Payments, loyalty and audit

```mermaid
erDiagram
  MONTHLY_ORDERS ||--o{ PAYMENT_TRANSACTIONS : paid_by
  PAYMENT_TRANSACTIONS ||--o{ PAYMENT_EVENTS : event_history
  PAYMENT_TRANSACTIONS ||--o{ REFUNDS : refunded_by
  MONTHLY_ORDERS ||--o{ CASH_COLLECTIONS : cash_paid
  CUSTOMER_PROFILES ||--|| LOYALTY_WALLETS : owns
  LOYALTY_WALLETS ||--o{ LOYALTY_EARNING_LOTS : contains
  LOYALTY_WALLETS ||--o{ LOYALTY_LEDGER : records
  LOYALTY_EARNING_LOTS ||--o{ LOYALTY_LEDGER : earns_or_reverses
  LOYALTY_WALLETS ||--o{ LOYALTY_REDEMPTIONS : redeems
  LOYALTY_REDEMPTIONS ||--|{ LOYALTY_REDEMPTION_ALLOCATIONS : consumes
  LOYALTY_EARNING_LOTS ||--o{ LOYALTY_REDEMPTION_ALLOCATIONS : allocated_from
  USERS ||--o{ AUDIT_LOGS : acts
  USERS ||--o{ NOTIFICATIONS : receives
  OUTBOX_EVENTS }o--o| NOTIFICATIONS : dispatches
```

Each loyalty earning lot stores its original conversion value. Redemption allocations preserve the lot-level conversion used. Payment and fulfilment states remain independent.

## 6. Relationship invariants to enforce
- One active recurring basket per customer (or enforce explicit active status uniqueness).
- At most one one-time basket per customer and monthly cycle.
- One immutable order snapshot per confirmed order.
- Order item source references must agree with basket_type and effective cycle.
- Every processing output batch has genealogy to one or more consumed inputs.
- No genealogy cycles; no consumption beyond available quantity.
- Source batch identity is not overwritten by processing output identity.
- Every package allocation references released saleable inventory and approved source genealogy.
- Package allocations reconcile to net package quantity.
- Recall descendant traversal follows genealogy and package allocation edges.
- Payment provider event and idempotency uniqueness prevents duplicate financial effects.
- Loyalty lot consumption cannot exceed remaining points and preserves historical conversion.
