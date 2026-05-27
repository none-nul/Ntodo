CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  platform TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  list_id UUID,
  sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  device_id UUID NOT NULL,
  server_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_todos_user_server_version ON todos(user_id, server_version);
CREATE INDEX IF NOT EXISTS idx_todos_user_deleted_at ON todos(user_id, deleted_at);

CREATE SEQUENCE IF NOT EXISTS global_server_version_seq;

CREATE TABLE IF NOT EXISTS sync_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL,
  client_change_id UUID NOT NULL,
  server_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_change_id),
  UNIQUE (user_id, server_version)
);

CREATE TABLE IF NOT EXISTS sync_acks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  last_acked_server_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
