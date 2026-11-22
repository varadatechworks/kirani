# Kirani package QR and public trace setup

## What is implemented

- Every packed package has an opaque public trace token.
- The customer page is served at `/trace/{token}` and loads the public trace API.
- The page shows package status, packed timestamp, packed products and source batch/processing ancestry.
- Farmer contact details, private addresses and payment data are deliberately excluded.
- Administrators can request a print-ready SVG QR label from `GET /api/v1/admin/packing/packages/{packageId}/label`.
- The packing workspace provides a print action for each package.

## Configuration

Set `PUBLIC_APP_URL` to the canonical public HTTPS origin, without a trailing slash, for example:

```
PUBLIC_APP_URL=https://kirani.example.com
```

Do not derive QR destinations from an untrusted Host header. The server uses this configured origin to build absolute trace URLs.

## Operations

1. Deploy the migration set and install dependencies (`npm install`).
2. Configure `PUBLIC_APP_URL` in the server environment.
3. Pack a customer order using inspected/available lots.
4. In the admin Packing workspace, select **Print QR label**.
5. Scan the printed code on a mobile device and verify the public trace page.
6. Test recalled packages: the trace must show `RECALLED` and the warning status.

If `PUBLIC_APP_URL` is missing or invalid, the label endpoint returns a configuration error rather than printing a QR code with an incorrect destination.

The trace token is an opaque bearer link. Treat it as public information once printed; do not put customer identity, private delivery address or payment details in the trace payload.
