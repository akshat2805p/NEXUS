-- Nexus PostgreSQL Schema
-- Note: The Go backend uses GORM's AutoMigrate to create these tables automatically.
-- This file is provided for reference and manual migrations if needed.

CREATE TABLE "users" (
    "id" bigserial,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "email" text,
    "username" text,
    "nexus_id" text,
    "web_authn_uid" bytea,
    "full_name" text,
    "avatar" text,
    "bio" text,
    "is_verified" boolean DEFAULT false,
    "is_online" boolean DEFAULT false,
    "last_seen_at" timestamptz,
    "phone_number" text,
    "phone_verified" boolean DEFAULT false,
    "country_code" text DEFAULT '+91',
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_users_email" ON "users"("email");
CREATE UNIQUE INDEX "idx_users_nexus_id" ON "users"("nexus_id");

CREATE TABLE "user_settings" (
    "id" bigserial,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "user_id" bigint,
    "notifications_enabled" boolean DEFAULT true,
    "sound_enabled" boolean DEFAULT true,
    "desktop_notifications" boolean DEFAULT true,
    "email_notifications" boolean DEFAULT false,
    "new_message_notifications" boolean DEFAULT true,
    "allow_direct_messages" boolean DEFAULT true,
    "show_online_status" boolean DEFAULT true,
    "allow_friend_requests" boolean DEFAULT true,
    "is_profile_public" boolean DEFAULT true,
    "blocked_users" text,
    "theme" text DEFAULT 'light',
    "language" text DEFAULT 'en',
    "timezone" text,
    "date_format" text DEFAULT 'DD/MM/YYYY',
    "message_sound_enabled" boolean DEFAULT true,
    "auto_delete_messages" boolean DEFAULT false,
    "auto_delete_after_days" bigint DEFAULT 0,
    "two_factor_enabled" boolean DEFAULT false,
    "biometric_auth_enabled" boolean DEFAULT false,
    "currency_preference" text DEFAULT 'USD',
    "transaction_alerts" boolean DEFAULT true,
    "low_balance_alert" boolean DEFAULT true,
    "low_balance_threshold" numeric DEFAULT 100,
    PRIMARY KEY ("id"),
    CONSTRAINT "fk_users_user_settings" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_user_settings_user_id" ON "user_settings"("user_id");

CREATE TABLE "accounts" (
    "id" bigserial,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "user_id" bigint,
    "account_type" text DEFAULT 'checking',
    "account_name" text,
    "account_number" text,
    "balance" numeric(20,2) DEFAULT 0,
    "currency" text DEFAULT 'INR',
    "provider" text,
    "is_active" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false,
    PRIMARY KEY ("id"),
    CONSTRAINT "fk_users_accounts" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_accounts_user_id" ON "accounts"("user_id");

CREATE TABLE "transactions" (
    "id" bigserial,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "user_id" bigint,
    "account_id" bigint,
    "transaction_type" text,
    "amount" numeric(20,2),
    "currency" text DEFAULT 'INR',
    "description" text,
    "status" text DEFAULT 'pending',
    "from_user_id" bigint,
    "to_user_id" bigint,
    "category" text,
    "tags" text,
    "reference_number" text,
    "receipt_url" text,
    "completed_at" timestamptz,
    "failure_reason" text,
    PRIMARY KEY ("id"),
    CONSTRAINT "fk_accounts_transactions" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL,
    CONSTRAINT "fk_users_transactions" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_transactions_user_id" ON "transactions"("user_id");
CREATE INDEX "idx_transactions_account_id" ON "transactions"("account_id");
CREATE INDEX "idx_transactions_transaction_type" ON "transactions"("transaction_type");
CREATE UNIQUE INDEX "idx_transactions_reference_number" ON "transactions"("reference_number");

-- Friendships, Messages, Authenticators omitted for brevity (handled by GORM)
