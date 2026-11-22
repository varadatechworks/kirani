# Kirani environment and payment-provider configuration

This guide documents the optional Razorpay checkout integration. The application remains safe to run without provider credentials: checkout returns a clear `PAYMENT_PROVIDER_NOT_CONFIGURED` response and offline payment reconciliation remains available to administrators.

## Required server secrets

Set these as deployment secrets; do not commit real values to Git:

| Variable | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` | Public checkout key ID returned to the customer browser |
| `RAZORPAY_KEY_SECRET` | Server-only secret used to create Razorpay orders |
| `RAZORPAY_WEBHOOK_SECRET` | Server-only secret used to verify webhook HMAC signatures |

The customer checkout endpoint is `POST /api/v1/customers/me/orders/{orderId}/payment-intent`. It creates or reuses a pending provider order for the outstanding order balance and returns the public key ID, provider order ID, amount in paise and currency. The browser opens Razorpay Checkout; it must not receive the key secret.

## Razorpay webhook

Configure this endpoint in the Razorpay dashboard:

```
POST https://<kirani-api-host>/api/v1/webhooks/razorpay
```

Subscribe to at least:
- `payment.captured`
- `payment.failed`

The server verifies `X-Razorpay-Signature` against the exact raw request bytes using HMAC-SHA256 and `RAZORPAY_WEBHOOK_SECRET`. The event ID is used for replay protection. Only a verified capture matching the stored provider order, amount and currency can append a payment capture to the ledger. A payment intent can be captured only once. Duplicate capture attempts and amount mismatches are acknowledged but stored as ignored reconciliation events; inspect these before closing the payment exception.

Only minimal payment fields are persisted in the gateway-event payload. Customer contact details from provider payloads are not copied into the event record.

## Refunds and offline payment methods

The current refund workflow is maker-checker: customer request, a different administrator's approval, then an administrator records the external provider/bank refund reference after it has actually been processed. Kirani does not yet call the Razorpay refund API automatically.

UPI/bank-transfer/COD/cash entries are reconciliation records for payments completed outside the online checkout flow. Do not record an online capture manually if the signed webhook has already created the capture ledger entry.

## Go-live checklist

- Complete Razorpay merchant onboarding and use test-mode credentials first.
- Configure all three secrets in the hosting platform's secret manager.
- Register the exact HTTPS webhook URL and subscribe to the event types above.
- Send test payments and verify capture, failure, replay, amount mismatch and duplicate-capture handling.
- Confirm webhook delivery retries and review ignored gateway events/reconciliation exceptions.
- Configure a production refund process and reconcile refund references before marking refunds processed.
- Confirm TLS, monitoring, alerting and incident ownership before switching to live mode.

Provider configuration and real transaction certification are external release gates; passing CI does not certify a live merchant account.
