# Kirani notification delivery configuration

## Channels

- In-app notifications are stored in the tenant-scoped notification inbox.
- Email is queued only when the recipient has explicitly enabled email for that notification category and has an email address.
- SMS preference is stored, but an SMS provider adapter is not connected yet. Do not claim SMS delivery from the preference flag.
- Email queue status and retry attempts are visible in the admin Support workspace.

## Resend configuration

Set these server-side environment values in the deployment secret manager:

```
RESEND_API_KEY=<server secret>
NOTIFICATION_FROM_EMAIL=Kirani <verified-sender@example.com>
```

Verify the sender/domain in Resend before production use. Never expose the API key to browser code.

The background worker claims due outbox rows under a PostgreSQL advisory lock, sends through the Resend API, stores provider message IDs, retries transient failures with backoff and marks exhausted jobs as failed. Stale in-progress jobs can be reclaimed after five minutes. When credentials are absent, jobs remain queued and the admin UI clearly reports that delivery is not configured.

## Testing and go-live

- CI tests the outbox, opt-in behavior, provider readiness and delivery worker using a mocked Resend response; CI does not send real emails.
- Configure test credentials and verify delivery to an internal mailbox.
- Confirm opt-in preferences, unsubscribe/legal requirements, sender authentication (SPF/DKIM/DMARC), bounce/complaint handling and operational alerts before enabling real customer email.
- SMS and WhatsApp remain separate future provider integrations.
