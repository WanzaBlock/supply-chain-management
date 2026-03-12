-- ============================================================
-- Blockchain Supply Chain System — Supabase Schema
-- Run this in your Supabase project's SQL Editor.
-- ============================================================

-- ── Users (wallet -> role mapping) ──────────────────────────────────────────
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  wallet     text unique not null,     -- lowercase 0x address
  role       text not null,            -- MANUFACTURER | DISTRIBUTOR | REGULATOR | CONSUMER
  name       text default '',
  created_at timestamptz default now()
);

-- ── Products ──────────────────────────────────────────────────────────────────
create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  product_id           text unique not null,    -- bytes32 hex (keccak256 of product_code)
  product_code         text unique not null,    -- human-readable code e.g. SEED-BATCH-001
  name                 text,
  origin               text,
  batch_number         text,
  expiry_date          text,
  description          text,
  metadata_hash        text not null,           -- IPFS CID or Supabase storage key
  manufacturer_wallet  text not null,
  is_active            boolean default true,
  tx_hash              text,
  block_number         bigint,
  deactivated_at       timestamptz,
  created_at           timestamptz default now()
);

-- ── Transfer Events ───────────────────────────────────────────────────────────
create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  product_id     text not null references products(product_id) on delete cascade,
  from_addr      text not null,
  to_addr        text not null,
  location_hash  text,
  condition_hash text,
  notes          text,
  tx_hash        text,
  block_number   bigint,
  recorded_at    timestamptz default now()
);

-- ── Sensor Logs ───────────────────────────────────────────────────────────────
create table if not exists sensor_logs (
  id             uuid primary key default gen_random_uuid(),
  product_id     text not null,
  topic          text,
  temperature    numeric,
  humidity       numeric,
  gps_lat        numeric,
  gps_lng        numeric,
  location_hash  text,
  condition_hash text,
  payload        jsonb,
  tx_hash        text,
  recorded_at    timestamptz default now()
);

-- ── Flags ─────────────────────────────────────────────────────────────────────
create table if not exists flags (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null,
  reason      text not null,
  flagged_by  text not null,          -- wallet address
  tx_hash     text,
  resolved    boolean default false,
  resolved_by text,
  resolved_at timestamptz,
  created_at  timestamptz default now()
);

-- ── Chain Events (raw event index) ────────────────────────────────────────────
create table if not exists chain_events (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null,         -- ProductRegistered | TransferRecorded | ProductDeactivated
  product_id   text not null,
  from_addr    text,
  to_addr      text,
  tx_hash      text,
  block_number bigint,
  raw_args     jsonb,
  indexed_at   timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_products_manufacturer  on products(manufacturer_wallet);
create index if not exists idx_products_product_id    on products(product_id);
create index if not exists idx_events_product_id      on events(product_id);
create index if not exists idx_events_recorded_at     on events(recorded_at);
create index if not exists idx_sensor_logs_product    on sensor_logs(product_id);
create index if not exists idx_flags_product_id       on flags(product_id);
create index if not exists idx_chain_events_type      on chain_events(event_type);
create index if not exists idx_chain_events_product   on chain_events(product_id);

-- ── Row-level security (optional, basic) ─────────────────────────────────────
-- Enable RLS and add policies as needed for your auth setup.
-- For now, use the service role key on the backend (not the anon key).
-- alter table products enable row level security;
-- alter table events   enable row level security;
