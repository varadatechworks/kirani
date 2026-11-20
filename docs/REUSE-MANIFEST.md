# App-skeleton reuse manifest

Kirani Phase 1 adopts focused primitives from `varadatechworks/app-skeleton` rather than importing the whole starter framework. Adapted modules currently included under `src/shared/skeleton`:

- Identity: identifier normalization, active-account checks, guarded account lifecycle and safe public profile projection.
- Authorization: explicit role/resource/action grants; server-side enforcement remains mandatory.
- Geo: coordinate validation and consent-aware event-location evidence; location is not mandatory where unavailable or not appropriate.
- Audit: structured audit event validation and recursive secret redaction.
- Billing: integer minor-unit arithmetic, basis-point calculations and tenant-scoped tax validation.
- Approvals: maker-checker separation, tenant boundary and optimistic version checks.
- Workflow: guarded status transition primitive.
- Observability: correlation IDs and safe user-facing error envelopes.

Additional Kirani-specific modules cover JWT verification, monthly basket versioning/cutoffs and admin-approved farmer listings. This is an adaptation, not a claim of byte-for-byte vendoring. Recheck the upstream module license and preserve required notices before release. See upstream repository integration/quality/security guidance when implementing further modules.

## Deliberately not yet integrated

Payments provider adapters, notification delivery, storage, multi-tenant middleware, full outbox processing and admin/reporting UI are not enabled by this foundation. They require configuration, threat-model review and end-to-end tests before activation.
