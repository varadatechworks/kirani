BEGIN;
CREATE TABLE IF NOT EXISTS app_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 user_id uuid NOT NULL REFERENCES users(id),category text NOT NULL CHECK(category IN ('ORDER','DELIVERY','PAYMENT','PROCUREMENT','LOYALTY','SUPPORT','SYSTEM','CAMPAIGN')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 140),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 2 AND 2000),
 resource_type text,resource_id text,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_notifications_user_idx ON app_notifications(tenant_id,user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS notification_preferences(
 tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL REFERENCES users(id),
 category text NOT NULL CHECK(category IN ('ORDER','DELIVERY','PAYMENT','PROCUREMENT','LOYALTY','SUPPORT','SYSTEM','CAMPAIGN')),
 in_app_enabled boolean NOT NULL DEFAULT true,email_enabled boolean NOT NULL DEFAULT false,sms_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,user_id,category)
);
CREATE TABLE IF NOT EXISTS support_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 ticket_number text NOT NULL,customer_id uuid NOT NULL REFERENCES users(id),category text NOT NULL CHECK(category IN ('ORDER','PAYMENT','DELIVERY','PRODUCT','ACCOUNT','OTHER')),
 subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 4 AND 160),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED')),
 priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
 assigned_to uuid REFERENCES users(id),order_id uuid REFERENCES orders(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,
 UNIQUE(tenant_id,ticket_number)
);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON support_tickets(tenant_id,status,priority,created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_customer_idx ON support_tickets(tenant_id,customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS support_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 ticket_id uuid NOT NULL REFERENCES support_tickets(id),sender_id uuid NOT NULL REFERENCES users(id),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 4000),internal_note boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(tenant_id,ticket_id,created_at);
COMMIT;
