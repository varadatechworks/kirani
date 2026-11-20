# Kirani Phase 1 — REST API Specification

**Version:** 1.0 | **Base path:** /api/v1 | **Status:** Contract baseline

## 1. API conventions
- HTTPS only. JSON request/response; UTF-8.
- Resource IDs are UUIDs; human-readable codes are display identifiers.
- Authentication uses secure session or short-lived access token plus refresh/session rotation; exact mechanism is implementation decision.
- Authorization is checked for every object and action.
- Pagination: cursor-based for large/append-only lists; bounded limit (default 25, max 100).
- Filtering/sorting are allowlisted. Dates use ISO-8601; timestamps UTC.
- Money is represented as integer minor units and ISO currency; quantities are decimal strings plus unit.
- Writes that may be retried accept Idempotency-Key. The server stores request hash and result; same key with different payload returns conflict.
- Use If-Match/ETag or version field for mutable resources to prevent lost updates.
- APIs return stable error codes and correlation ID; never leak stack traces or provider secrets.

## 2. Standard response envelopes

Success:
```json
{
  "data": { "id": "uuid", "status": "CONFIRMED" },
  "meta": { "correlationId": "req_opaque", "version": "v1" }
}
```

Collection:
```json
{
  "data": [],
  "page": { "nextCursor": null, "hasMore": false },
  "meta": { "correlationId": "req_opaque" }
}
```

Error:
```json
{
  "error": {
    "code": "CUTOFF_PASSED",
    "message": "This monthly cycle is no longer accepting changes.",
    "fieldErrors": [],
    "correlationId": "req_opaque"
  }
}
```

Suggested HTTP mapping: 400 malformed request; 401 unauthenticated; 403 unauthorized; 404 not found/hidden cross-scope resource; 409 state/version/idempotency conflict; 422 business validation; 429 rate limit; 502/503 transient provider/service failure; 500 unexpected error. Do not expose whether a hidden cross-customer resource exists.

## 3. Identity and access
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /auth/invitations/redeem | Validate/redeem invitation |
| POST | /auth/register | Register customer/farmer/supplier |
| POST | /auth/login | Authenticate |
| POST | /auth/logout | Revoke current session |
| POST | /auth/mfa/challenge | Begin MFA challenge |
| POST | /auth/mfa/verify | Verify MFA |
| GET | /customers/me | Current customer profile |
| PATCH | /customers/me | Update permitted profile fields |
| GET/POST/PATCH | /customers/me/addresses | List/create/update own addresses |
| POST | /admin/invitations | Create invitation |
| GET/PATCH | /admin/users/{userId} | Review/suspend/reactivate user |

## 4. Catalogue and monthly basket
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /catalogue/categories | Active categories |
| GET | /catalogue/products | Search/filter approved products |
| GET | /catalogue/products/{productId} | Product detail, pack and claims |
| GET | /monthly-cycles/current | Current eligible cycle and cutoff |
| GET | /monthly-cycles/{cycleId} | Cycle details |
| GET/POST | /customers/me/recurring-basket | Read/create recurring basket |
| PUT | /customers/me/recurring-basket | Save new basket version |
| GET/POST | /customers/me/cycles/{cycleId}/one-time-basket | Read/create cycle-specific basket |
| PUT | /customers/me/cycles/{cycleId}/one-time-basket | Replace/update one-time lines |
| POST | /monthly-orders/preview | Calculate combined preview |
| POST | /monthly-orders/confirm | Confirm and snapshot order |
| GET | /customers/me/orders | Own order history |
| GET | /orders/{orderId} | Authorized order detail |
| POST | /orders/{orderId}/amendment-requests | Request post-confirmation change |
| POST | /orders/{orderId}/cancellation-requests | Request cancellation |

Preview/confirm must recalculate price, tax, availability and cutoff on the server. Client totals are informational only.

### Example confirm request
```json
{
  "cycleId": "uuid",
  "recurringBasketVersion": 4,
  "oneTimeBasketId": "uuid",
  "deliveryAddressId": "uuid",
  "deliveryWindowId": "uuid",
  "substitutionPolicy": "ASK_CUSTOMER",
  "customerAcceptedTermsVersion": "terms-2026-01"
}
```

## 5. Farmer, supplier, customer requests and campaigns
| Method | Endpoint | Purpose |
|---|---|---|
| POST/GET | /farmers/applications | Apply/list own application |
| GET/PATCH | /farmers/me/profile | Own farmer profile |
| POST/GET | /farmers/me/listings | Submit/list own listings |
| PATCH | /farmers/me/listings/{listingId} | Update draft/approved listing |
| GET | /farmers/me/sourcing-opportunities | Eligible sourcing opportunities |
| POST | /sourcing-opportunities/{id}/farmer-responses | Submit availability/quote |
| POST/GET | /customers/me/product-requests | Submit/list own product requests |
| GET | /customers/me/product-requests/{id} | Request status |
| GET/POST | /admin/product-requests | Review/aggregate requests |
| POST | /admin/sourcing-opportunities | Publish sourcing demand |
| POST | /admin/listings/{id}/decision | Approve/reject/request changes/suspend |
| POST | /admin/campaigns | Create targeted campaign |
| POST | /admin/campaigns/{id}/schedule | Set schedule/stop rules |

## 6. Procurement and goods receipt
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | /admin/supplier-offers | Review/manage supplier offers |
| GET/POST | /procurement/purchase-orders | Create/list purchase orders |
| GET | /procurement/purchase-orders/{id} | PO detail |
| POST | /procurement/purchase-orders/{id}/approve | Approval workflow |
| POST | /procurement/purchase-orders/{id}/dispatch | Record supplier dispatch |
| POST | /goods-receipts | Record receipt |
| POST | /goods-receipts/{id}/inspect | Record inspection outcome |
| GET | /inventory/batches | Authorized inventory batches |
| POST | /inventory/batches/{id}/adjustments | Approved adjustment |
| GET | /inventory/movements | Inventory ledger |

## 7. Mill and processing
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /mill/jobs | Assigned facility jobs |
| GET | /mill/jobs/{jobId} | Job/stage details |
| POST | /mill/jobs/{jobId}/accept | Accept assigned job |
| POST | /mill/jobs/{jobId}/receipt | Scan/acknowledge source material |
| POST | /mill/jobs/{jobId}/stages/{stageId}/start | Start stage |
| POST | /mill/jobs/{jobId}/stages/{stageId}/complete | Record measured stage outputs |
| POST | /mill/jobs/{jobId}/transfers | Record custody transfer |
| POST | /mill/jobs/{jobId}/submit-for-reconciliation | Complete stage and submit variance |
| POST | /admin/mill/jobs | Create/assign processing job |
| POST | /admin/mill/jobs/{jobId}/review | Approve/reject reconciliation |
| POST | /admin/mill/facilities | Register facility |
| POST | /admin/mill/stage-templates | Configure process template |

Stage completion request must identify each input batch and quantity; each output batch code/type/quantity/unit; by-product, waste/loss and remaining quantity; machine/operator; timestamps; quality checks; evidence; and explanation for adjustments. Server calculates mass balance and verifies assigned stock.

## 8. Quality, packing, traceability and recall
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /quality/inspections | Create inspection |
| POST | /quality/batches/{batchId}/disposition | Release/quarantine/rework/reject |
| POST | /packing/pick-lists | Generate pick list |
| POST | /packing/packages | Create package and source allocations |
| POST | /packing/packages/{packageId}/label | Generate/print QR label |
| GET | /trace/{publicToken} | Curated public trace view (rate-limited) |
| POST | /admin/recalls | Open recall |
| GET | /admin/recalls/{recallId}/impact | Affected batches/packages/orders/customers |
| POST | /admin/recalls/{recallId}/dispositions | Record block/notify/return/dispose actions |

Public trace endpoint uses opaque token, field allowlist and source-disclosure policy. Do not use internal UUIDs as public tokens.

## 9. Delivery and support
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /delivery/me/assignments | Assigned stops |
| POST | /delivery/assignments/{id}/events | Record delivery event |
| POST | /delivery/assignments/{id}/cash-collections | Record COD collection |
| GET/POST | /customers/me/support-tickets | List/create tickets |
| GET | /support/tickets/{id} | Authorized ticket |
| POST | /support/tickets/{id}/messages | Add support communication |
| POST | /support/tickets/{id}/resolve | Resolve with outcome |

## 10. Payments, refunds and loyalty
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /payments/intents | Initiate payment for authorized order |
| POST | /webhooks/payments/{provider} | Verify/process provider callback |
| GET | /customers/me/payments | Own payment history |
| POST | /payments/{paymentId}/refunds | Request/execute authorized refund |
| GET | /customers/me/loyalty/wallet | Wallet and lot summary |
| GET | /customers/me/loyalty/ledger | Immutable ledger |
| POST | /customers/me/loyalty/redemptions/preview | Preview eligible lot allocation |
| POST | /customers/me/loyalty/redemptions | Redeem against eligible order |
| GET/POST | /admin/loyalty/policies | Read/create policy version |
| GET | /admin/finance/reconciliation | Payment/COD reconciliation |
| GET | /admin/finance/payables | Farmer/supplier payable view |
| POST | /admin/finance/payouts | Record approved payout |

Webhook endpoint must verify provider signature against raw request body, enforce provider event uniqueness and respond quickly after durable event recording. Async processing may complete later.

## 11. Admin configuration and reporting
| Method | Endpoint | Purpose |
|---|---|---|
| POST/PATCH | /admin/monthly-cycles | Configure/open/close cycle |
| POST | /admin/monthly-cycles/{id}/cutoff-exceptions | Audited exception |
| GET | /admin/dashboard | Operational KPIs/exceptions |
| GET | /admin/reports/{reportCode} | Authorized report |
| GET/POST | /admin/service-areas | Serviceability configuration |
| GET/POST | /admin/delivery-windows | Delivery capacity/windows |
| GET | /admin/audit-logs | Restricted audit search |
| GET | /health/live | Process liveness |
| GET | /health/ready | Dependency readiness (no secrets) |

## 12. Idempotency and concurrency rules
- Require Idempotency-Key for order confirmation, payment intent, refund, loyalty redemption, PO approval where retried, processing stage completion and COD collection.
- Store actor, operation, key, request hash, response code/body and expiry/retention.
- Same key + same request returns original result; same key + different request returns 409.
- Lock monthly cycle/order/stock lots/wallet lots when competing writes could oversell or double-spend.
- Use optimistic version checks for basket edits and admin configuration.
- Never keep DB transaction open while waiting for gateway/messaging response.

## 13. API security and versioning
- API v1 is additive-compatible; breaking changes require v2 or negotiated migration.
- Use object-level authorization on every route; scope list queries before pagination.
- Rate-limit login, invitations, public trace, product requests and payment initiation.
- Validate payload schema, content type, file size and upload token.
- Redact provider payloads and PII from logs.
- Error response includes correlation ID; support staff can use it without seeing secrets.
- Generate OpenAPI 3.1 from route schemas and add contract tests before implementation release.
