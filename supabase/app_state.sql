-- ============================================================================
-- KisanTractor — application state table
-- ----------------------------------------------------------------------------
-- Run this file once in the Supabase SQL editor (or `supabase db push`).
--
-- The Next.js server stores the booking engine's database document in this
-- single row. The table is service-role only: RLS is enabled and no policies
-- are granted, so the anon and authenticated keys can never read or write it.
-- Only the server (SUPABASE_SERVICE_ROLE_KEY) has access.
-- ============================================================================

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on public.app_state from anon, authenticated;
grant all on public.app_state to service_role;

-- Initial document state with empty arrays and default catalog equipment.
-- If the row already exists with '{}', update it to the proper initial schema.
insert into public.app_state (id, data, version)
values (
  'main',
  '{
    "users": [],
    "farmerProfiles": [],
    "ownerProfiles": [],
    "tractors": [],
    "pricing": [],
    "bookings": [],
    "workSessions": [],
    "workMeasurements": [],
    "paymentRecords": [],
    "bookingStatusHistory": [],
    "notifications": [],
    "disputes": [],
    "sessions": [],
    "otpChallenges": [],
    "equipment": [
      { "id": "eq_plough", "name": "Plough", "description": "Deep soil turning and primary tillage", "icon": "plough" },
      { "id": "eq_rotavator", "name": "Rotavator", "description": "Secondary seedbed preparation and fine pulverising", "icon": "rotavator" },
      { "id": "eq_trolley", "name": "Trolley / Trailer", "description": "Crop hauling, manure transport and heavy farm logistics", "icon": "trolley" },
      { "id": "eq_seed_drill", "name": "Seed drill", "description": "Even row sowing", "icon": "seed" },
      { "id": "eq_sprayer", "name": "Sprayer", "description": "Field spraying equipment", "icon": "spray" }
    ]
  }'::jsonb,
  1
)
on conflict (id) do update
set data = excluded.data
where app_state.data = '{}'::jsonb or app_state.data is null;

comment on table public.app_state is
  'Single-row document store for the KisanTractor server. Service role only.';
