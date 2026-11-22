BEGIN;
CREATE TABLE IF NOT EXISTS notification_email_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 notification_id uuid REFERENCES app_notifications(id),
 user_id uuid NOT NULL REFERENCES users(id),
 recipient_email text NOT NULL CHECK(length(trim(recipient_email)) BETWEEN 3 AND 320),
 subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 2 AND 140),
 body_text text NOT NULL CHECK(length(trim(body_text)) BETWEEN 2 AND 2000),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','FAILED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 provider_message_id text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 UNIQUE(tenant_id,notification_id)
);
CREATE INDEX IF NOT EXISTS notification_email_outbox_due_idx
 ON notification_email_outbox(status,next_attempt_at,created_at) WHERE status IN ('PENDING','SENDING');
COMMIT;
