-- ============================================================================
-- KisanTractor — production Supabase schema, RLS and booking RPCs
-- ----------------------------------------------------------------------------
-- The demo app ships with a server-side JSON store so it can run without
-- credentials. This file is the migration path for a real Supabase project.
--
-- Run it in the Supabase SQL editor (or `supabase db push`) after enabling
-- Auth. It creates:
--   * profiles for farmers and tractor owners
--   * tractors, equipment and rates
--   * bookings, work sessions, measurements, payments and status history
--   * notifications and disputes
--   * row-level security for every table
--   * SECURITY DEFINER RPCs that own all booking state transitions
--
-- Design rule: the browser never writes booking status, prices, bills or
-- payment confirmations directly. Those mutations only happen through the
-- RPCs below, which validate permissions, availability, conflicts and totals.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('farmer', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.language_code as enum ('en', 'hi', 'mr');
exception when duplicate_object then null; end $$;

-- All 22 languages in the Eighth Schedule of the Indian Constitution, plus English.
alter type public.language_code add value if not exists 'as';
alter type public.language_code add value if not exists 'bn';
alter type public.language_code add value if not exists 'brx';
alter type public.language_code add value if not exists 'doi';
alter type public.language_code add value if not exists 'gu';
alter type public.language_code add value if not exists 'kn';
alter type public.language_code add value if not exists 'ks';
alter type public.language_code add value if not exists 'kok';
alter type public.language_code add value if not exists 'mai';
alter type public.language_code add value if not exists 'ml';
alter type public.language_code add value if not exists 'mni';
alter type public.language_code add value if not exists 'ne';
alter type public.language_code add value if not exists 'or';
alter type public.language_code add value if not exists 'pa';
alter type public.language_code add value if not exists 'sa';
alter type public.language_code add value if not exists 'sat';
alter type public.language_code add value if not exists 'sd';
alter type public.language_code add value if not exists 'ta';
alter type public.language_code add value if not exists 'te';
alter type public.language_code add value if not exists 'ur';

do $$ begin
  create type public.tractor_status as enum ('active', 'maintenance', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_type as enum ('ploughing', 'rotavation', 'trolley');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pricing_type as enum ('hourly', 'acre', 'trip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'PENDING', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED',
    'COMPLETION_PENDING', 'BILL_GENERATED', 'PAYMENT_PENDING', 'PAID',
    'COMPLETED', 'REJECTED', 'CANCELLED_BY_FARMER', 'CANCELLED_BY_OWNER',
    'EXPIRED', 'DISPUTED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('upi', 'cash', 'bank', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('recorded', 'confirmed', 'disputed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('booking', 'payment', 'work', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dispute_status as enum ('open', 'resolved');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Profiles and role-specific data
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'farmer',
  name text not null check (char_length(trim(name)) between 2 and 80),
  mobile text unique,
  preferred_language public.language_code not null default 'en',
  profile_photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null default '',
  village text not null default '',
  district text not null default 'Nashik',
  state text not null default 'Maharashtra',
  lat double precision not null default 20.0833,
  lng double precision not null default 73.9333,
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null default '',
  village text not null default '',
  district text not null default 'Nashik',
  state text not null default 'Maharashtra',
  lat double precision not null default 20.0833,
  lng double precision not null default 73.9333,
  online boolean not null default false,
  service_radius_km integer not null default 10 check (service_radius_km between 1 and 50),
  updated_at timestamptz not null default now()
);

-- Optional direct-payment details. Never store bank passwords, UPI PINs or OTPs.
create table if not exists public.owner_payment_details (
  owner_id uuid primary key references public.owner_profiles(user_id) on delete cascade,
  share_upi boolean not null default false,
  upi_id text not null default '',
  share_qr boolean not null default false,
  qr_image text not null default '',
  share_bank boolean not null default false,
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  bank_ifsc text not null default '',
  preferred_method public.payment_method not null default 'upi',
  updated_at timestamptz not null default now(),
  constraint owner_payment_upi_format check (
    share_upi = false or upi_id ~* '^[a-z0-9._-]{2,}@[a-z]{2,}$'
  ),
  constraint owner_payment_bank_format check (
    share_bank = false
    or (
      bank_account_name <> ''
      and bank_account_number ~ '^[0-9]{9,18}$'
      and bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
    )
  )
);

-- ----------------------------------------------------------------------------
-- Tractor catalogue
-- ----------------------------------------------------------------------------
create table if not exists public.equipment (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default 'wrench'
);

create table if not exists public.tractors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand text not null,
  model text not null,
  registration_number text not null unique,
  horsepower integer not null default 50 check (horsepower between 15 and 200),
  manufacturing_year integer not null default extract(year from now())::integer,
  image text not null default '',
  images text[] not null default '{}',
  status public.tractor_status not null default 'active',
  village text not null default '',
  district text not null default 'Nashik',
  state text not null default 'Maharashtra',
  lat double precision not null default 20.0833,
  lng double precision not null default 73.9333,
  service_radius_km integer not null default 10 check (service_radius_km between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tractor_equipment (
  tractor_id uuid not null references public.tractors(id) on delete cascade,
  equipment_id text not null references public.equipment(id) on delete restrict,
  primary key (tractor_id, equipment_id)
);

create table if not exists public.pricing (
  tractor_id uuid primary key references public.tractors(id) on delete cascade,
  hourly_enabled boolean not null default false,
  hourly_rate integer not null default 0 check (hourly_rate >= 0),
  acre_enabled boolean not null default false,
  acre_rate integer not null default 0 check (acre_rate >= 0),
  trip_enabled boolean not null default false,
  trip_rate integer not null default 0 check (trip_rate >= 0),
  updated_at timestamptz not null default now(),
  constraint pricing_at_least_one check (hourly_enabled or acre_enabled or trip_enabled),
  constraint pricing_hourly_positive check (hourly_enabled = false or hourly_rate > 0),
  constraint pricing_acre_positive check (acre_enabled = false or acre_rate > 0),
  constraint pricing_trip_positive check (trip_enabled = false or trip_rate > 0)
);

-- ----------------------------------------------------------------------------
-- Bookings and work records
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique default (
    'KT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  farmer_id uuid not null references public.profiles(id) on delete restrict,
  tractor_id uuid not null references public.tractors(id) on delete restrict,
  booking_for text not null default 'self' check (booking_for in ('self', 'other')),
  recipient_name text,
  recipient_mobile text,
  service_location jsonb not null,
  service_type public.service_type not null,
  pricing_type public.pricing_type not null,
  agreed_rate integer not null check (agreed_rate > 0),
  booking_date date not null,
  start_time time not null,
  estimated_minutes integer check (estimated_minutes between 30 and 720),
  estimated_acres numeric(6, 2) check (estimated_acres > 0 and estimated_acres <= 100),
  estimated_trips integer check (estimated_trips between 1 and 20),
  estimated_amount integer not null check (estimated_amount >= 0),
  final_amount integer check (final_amount is null or final_amount >= 0),
  status public.booking_status not null default 'PENDING',
  note text not null default '',
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id),
  farmer_location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_recipient_required check (
    booking_for = 'self'
    or (
      recipient_name is not null and char_length(trim(recipient_name)) > 0
      and recipient_mobile ~ '^[6-9][0-9]{9}$'
    )
  )
);

-- Existing installations: live farmer GPS shared for one booking at a time.
alter table public.bookings add column if not exists farmer_location jsonb;

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  segments jsonb not null default '[]'::jsonb,
  total_minutes integer not null default 0 check (total_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_measurements (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  completed_acres numeric(6, 2),
  completed_trips integer check (completed_trips is null or completed_trips between 1 and 20),
  billable_minutes integer check (billable_minutes is null or billable_minutes >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount integer not null check (amount >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'recorded',
  recorded_by uuid not null references public.profiles(id),
  paid_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  old_status public.booking_status,
  new_status public.booking_status not null,
  changed_by uuid references public.profiles(id),
  changed_by_role text not null check (changed_by_role in ('farmer', 'owner', 'system')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type public.notification_type not null default 'system',
  booking_id uuid references public.bookings(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  raised_by uuid not null references public.profiles(id),
  raised_by_role public.user_role not null,
  reason text not null,
  details text not null,
  status public.dispute_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists tractors_owner_idx on public.tractors(owner_id);
create index if not exists tractors_search_idx on public.tractors(status, village, district);
create index if not exists bookings_farmer_idx on public.bookings(farmer_id, created_at desc);
create index if not exists bookings_tractor_idx on public.bookings(tractor_id, booking_date, start_time);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists payments_booking_idx on public.payment_records(booking_id);
create index if not exists history_booking_idx on public.booking_status_history(booking_id, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);
create index if not exists disputes_booking_idx on public.disputes(booking_id);

-- ----------------------------------------------------------------------------
-- Utility functions
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists farmer_profiles_touch on public.farmer_profiles;
create trigger farmer_profiles_touch before update on public.farmer_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists owner_profiles_touch on public.owner_profiles;
create trigger owner_profiles_touch before update on public.owner_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists tractors_touch on public.tractors;
create trigger tractors_touch before update on public.tractors
for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
for each row execute function public.touch_updated_at();

drop trigger if exists work_sessions_touch on public.work_sessions;
create trigger work_sessions_touch before update on public.work_sessions
for each row execute function public.touch_updated_at();

-- Create the profile row after Supabase Auth creates a user. Role and name are
-- passed in the sign-up metadata. The backend still decides what dashboard to
-- show, based on profiles.role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_name text;
  v_mobile text;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'farmer');
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'New user');
  v_mobile := nullif(regexp_replace(coalesce(new.phone, new.raw_user_meta_data ->> 'mobile', ''), '\D', '', 'g'), '');

  insert into public.profiles (id, role, name, mobile, preferred_language)
  values (new.id, v_role, v_name, v_mobile, 'en')
  on conflict (id) do nothing;

  if v_role = 'owner' then
    insert into public.owner_profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
    insert into public.owner_payment_details (owner_id) values (new.id)
    on conflict (owner_id) do nothing;
  else
    insert into public.farmer_profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_booking_party(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.tractors t on t.id = b.tractor_id
    where b.id = p_booking_id
      and (b.farmer_id = auth.uid() or t.owner_id = auth.uid())
  );
$$;

create or replace function public.is_booking_owner(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.tractors t on t.id = b.tractor_id
    where b.id = p_booking_id and t.owner_id = auth.uid()
  );
$$;

create or replace function public.is_booking_farmer(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.farmer_id = auth.uid()
  );
$$;

create or replace function public.calculate_amount(
  p_pricing_type public.pricing_type,
  p_rate integer,
  p_minutes integer default null,
  p_acres numeric default null,
  p_trips integer default null
)
returns integer
language sql
immutable
as $$
  select case p_pricing_type
    when 'hourly' then round((p_rate::numeric * coalesce(p_minutes, 0)) / 60.0)::integer
    when 'acre' then round(p_rate::numeric * coalesce(p_acres, 0))::integer
    when 'trip' then round(p_rate::numeric * coalesce(p_trips, 0))::integer
  end;
$$;

create or replace function public.push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type public.notification_type,
  p_booking_id uuid default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, body, type, booking_id)
  values (p_user_id, p_title, p_body, p_type, p_booking_id);
$$;

create or replace function public.add_history(
  p_booking_id uuid,
  p_old_status public.booking_status,
  p_new_status public.booking_status,
  p_actor uuid,
  p_role text,
  p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.booking_status_history
    (booking_id, old_status, new_status, changed_by, changed_by_role, reason)
  values (p_booking_id, p_old_status, p_new_status, p_actor, p_role, p_reason);
$$;

-- Check that a tractor is free around a requested slot. The estimate is used
-- for hourly work; acre and trip bookings default to two hours.
create or replace function public.has_booking_conflict(
  p_tractor_id uuid,
  p_date date,
  p_start time,
  p_duration_minutes integer,
  p_exclude_booking uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.tractor_id = p_tractor_id
      and (p_exclude_booking is null or b.id <> p_exclude_booking)
      and b.status in (
        'PENDING', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS',
        'PAUSED', 'COMPLETION_PENDING', 'BILL_GENERATED', 'PAYMENT_PENDING'
      )
      and b.booking_date = p_date
      and b.start_time < (p_start + make_interval(mins => greatest(30, p_duration_minutes)))
      and p_start < (b.start_time + make_interval(mins => coalesce(b.estimated_minutes, 120)))
  );
$$;

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.farmer_profiles enable row level security;
alter table public.owner_profiles enable row level security;
alter table public.owner_payment_details enable row level security;
alter table public.equipment enable row level security;
alter table public.tractors enable row level security;
alter table public.tractor_equipment enable row level security;
alter table public.pricing enable row level security;
alter table public.bookings enable row level security;
alter table public.work_sessions enable row level security;
alter table public.work_measurements enable row level security;
alter table public.payment_records enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.disputes enable row level security;

-- Profiles: users read and update only their own row. The public API uses the
-- service role to return the safe fields needed by the marketplace.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists farmer_profiles_own on public.farmer_profiles;
create policy farmer_profiles_own on public.farmer_profiles
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists owner_profiles_own on public.owner_profiles;
create policy owner_profiles_own on public.owner_profiles
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Payment details: the owner manages their own row. A farmer can read them only
-- for a booking that is already accepted or further along.
drop policy if exists owner_payment_details_owner on public.owner_payment_details;
create policy owner_payment_details_owner on public.owner_payment_details
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists owner_payment_details_farmer on public.owner_payment_details;
create policy owner_payment_details_farmer on public.owner_payment_details
for select using (
  exists (
    select 1
    from public.bookings b
    join public.tractors t on t.id = b.tractor_id
    where b.farmer_id = auth.uid()
      and t.owner_id = owner_payment_details.owner_id
      and b.status in (
        'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETION_PENDING',
        'BILL_GENERATED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED', 'DISPUTED'
      )
  )
);

-- Catalogue is readable by signed-in users. Writes are done by the owner API
-- (or service role) and validated again by the database.
drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment
for select to authenticated using (true);

drop policy if exists tractors_read on public.tractors;
create policy tractors_read on public.tractors
for select to authenticated
using (status = 'active' or owner_id = auth.uid());

drop policy if exists tractors_owner_write on public.tractors;
create policy tractors_owner_write on public.tractors
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists tractor_equipment_read on public.tractor_equipment;
create policy tractor_equipment_read on public.tractor_equipment
for select to authenticated
using (
  exists (
    select 1 from public.tractors t
    where t.id = tractor_equipment.tractor_id
      and (t.status = 'active' or t.owner_id = auth.uid())
  )
);

drop policy if exists tractor_equipment_owner_write on public.tractor_equipment;
create policy tractor_equipment_owner_write on public.tractor_equipment
for all using (
  exists (select 1 from public.tractors t where t.id = tractor_equipment.tractor_id and t.owner_id = auth.uid())
) with check (
  exists (select 1 from public.tractors t where t.id = tractor_equipment.tractor_id and t.owner_id = auth.uid())
);

drop policy if exists pricing_read on public.pricing;
create policy pricing_read on public.pricing
for select to authenticated
using (
  exists (
    select 1 from public.tractors t
    where t.id = pricing.tractor_id
      and (t.status = 'active' or t.owner_id = auth.uid())
  )
);

drop policy if exists pricing_owner_write on public.pricing;
create policy pricing_owner_write on public.pricing
for all using (
  exists (select 1 from public.tractors t where t.id = pricing.tractor_id and t.owner_id = auth.uid())
) with check (
  exists (select 1 from public.tractors t where t.id = pricing.tractor_id and t.owner_id = auth.uid())
);

-- Bookings: parties can read. A farmer can create a pending request. All
-- later changes go through the RPCs below, so direct updates are not granted.
drop policy if exists bookings_select_party on public.bookings;
create policy bookings_select_party on public.bookings
for select using (public.is_booking_party(id));

drop policy if exists bookings_insert_farmer on public.bookings;
create policy bookings_insert_farmer on public.bookings
for insert to authenticated
with check (
  farmer_id = auth.uid()
  and status = 'PENDING'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'farmer'
  )
);

drop policy if exists work_sessions_select_party on public.work_sessions;
create policy work_sessions_select_party on public.work_sessions
for select using (public.is_booking_party(booking_id));

drop policy if exists measurements_select_party on public.work_measurements;
create policy measurements_select_party on public.work_measurements
for select using (public.is_booking_party(booking_id));

drop policy if exists payments_select_party on public.payment_records;
create policy payments_select_party on public.payment_records
for select using (public.is_booking_party(booking_id));

drop policy if exists history_select_party on public.booking_status_history;
create policy history_select_party on public.booking_status_history
for select using (public.is_booking_party(booking_id));

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists disputes_select_party on public.disputes;
create policy disputes_select_party on public.disputes
for select using (public.is_booking_party(booking_id));

drop policy if exists disputes_insert_party on public.disputes;
create policy disputes_insert_party on public.disputes
for insert to authenticated
with check (
  raised_by = auth.uid()
  and public.is_booking_party(booking_id)
);

-- ----------------------------------------------------------------------------
-- RPC: create booking
-- ----------------------------------------------------------------------------
create or replace function public.create_booking(
  p_tractor_id uuid,
  p_booking_for text,
  p_recipient_name text,
  p_recipient_mobile text,
  p_service_location jsonb,
  p_service_type public.service_type,
  p_pricing_type public.pricing_type,
  p_booking_date date,
  p_start_time time,
  p_estimated_minutes integer default null,
  p_estimated_acres numeric default null,
  p_estimated_trips integer default null,
  p_note text default ''
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_tractor public.tractors;
  v_owner public.owner_profiles;
  v_pricing public.pricing;
  v_rate integer;
  v_amount integer;
  v_duration integer;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'Please sign in to continue.' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'farmer' then
    raise exception 'Only a farmer can create a booking.' using errcode = '42501';
  end if;

  select * into v_tractor from public.tractors where id = p_tractor_id for share;
  if not found then
    raise exception 'Tractor not found.' using errcode = 'P0002';
  end if;
  if v_tractor.status <> 'active' then
    raise exception 'This tractor is not available for new bookings.' using errcode = '22023';
  end if;

  select * into v_owner from public.owner_profiles where user_id = v_tractor.owner_id;
  if not found or v_owner.online = false then
    raise exception 'This owner is offline for new requests.' using errcode = '22023';
  end if;

  select * into v_pricing from public.pricing where tractor_id = p_tractor_id;
  if not found then
    raise exception 'Pricing is not configured for this tractor.' using errcode = 'P0002';
  end if;

  if p_pricing_type = 'hourly' then
    if v_pricing.hourly_enabled = false then
      raise exception 'Hourly pricing is not available for this tractor.' using errcode = '22023';
    end if;
    if p_estimated_minutes is null or p_estimated_minutes < 30 or p_estimated_minutes > 720 then
      raise exception 'Enter an estimated time between 30 minutes and 12 hours.' using errcode = '22023';
    end if;
    v_rate := v_pricing.hourly_rate;
    v_duration := p_estimated_minutes;
  elsif p_pricing_type = 'acre' then
    if v_pricing.acre_enabled = false then
      raise exception 'Per-acre pricing is not available for this tractor.' using errcode = '22023';
    end if;
    if p_estimated_acres is null or p_estimated_acres <= 0 or p_estimated_acres > 100 then
      raise exception 'Enter an acreage between 0 and 100.' using errcode = '22023';
    end if;
    v_rate := v_pricing.acre_rate;
    v_duration := 120;
  else
    if v_pricing.trip_enabled = false then
      raise exception 'Per-trip pricing is not available for this tractor.' using errcode = '22023';
    end if;
    if p_estimated_trips is null or p_estimated_trips < 1 or p_estimated_trips > 20 then
      raise exception 'Choose between 1 and 20 trips.' using errcode = '22023';
    end if;
    v_rate := v_pricing.trip_rate;
    v_duration := 120;
  end if;

  if p_booking_for not in ('self', 'other') then
    raise exception 'Choose who the booking is for.' using errcode = '22023';
  end if;
  if p_booking_for = 'other' and (
    p_recipient_name is null or trim(p_recipient_name) = ''
    or p_recipient_mobile !~ '^[6-9][0-9]{9}$'
  ) then
    raise exception 'Add a valid recipient name and 10-digit mobile number.' using errcode = '22023';
  end if;

  if p_booking_date < current_date then
    raise exception 'Choose today or a future date.' using errcode = '22023';
  end if;
  if p_booking_date = current_date
     and p_start_time < (current_time + interval '30 minutes')::time then
    raise exception 'For today, choose a start time at least 30 minutes from now.' using errcode = '22023';
  end if;

  if public.has_booking_conflict(p_tractor_id, p_booking_date, p_start_time, v_duration, null) then
    raise exception 'This tractor is already booked around that time. Choose another slot or tractor.' using errcode = '23P01';
  end if;

  v_amount := public.calculate_amount(
    p_pricing_type, v_rate, p_estimated_minutes, p_estimated_acres, p_estimated_trips
  );

  insert into public.bookings (
    farmer_id, tractor_id, booking_for, recipient_name, recipient_mobile,
    service_location, service_type, pricing_type, agreed_rate, booking_date,
    start_time, estimated_minutes, estimated_acres, estimated_trips,
    estimated_amount, status, note
  ) values (
    v_uid, p_tractor_id, p_booking_for,
    case when p_booking_for = 'other' then trim(p_recipient_name) else null end,
    case when p_booking_for = 'other' then p_recipient_mobile else null end,
    p_service_location, p_service_type, p_pricing_type, v_rate, p_booking_date,
    p_start_time, p_estimated_minutes, p_estimated_acres, p_estimated_trips,
    v_amount, 'PENDING', left(coalesce(p_note, ''), 500)
  ) returning * into v_booking;

  perform public.add_history(
    v_booking.id, null, 'PENDING', v_uid, 'farmer', 'Booking request sent'
  );
  perform public.push_notification(
    v_tractor.owner_id,
    'New booking request',
    'A farmer sent a booking request for ' || v_booking.booking_number || '.',
    'booking',
    v_booking.id
  );

  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: owner accepts or rejects a pending request
-- ----------------------------------------------------------------------------
create or replace function public.respond_to_booking(
  p_booking_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_owner public.profiles;
  v_duration integer;
  v_new_status public.booking_status;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then
    raise exception 'Only the tractor owner can respond to this request.' using errcode = '42501';
  end if;
  if v_booking.status <> 'PENDING' then
    raise exception 'This request is no longer pending.' using errcode = '22023';
  end if;

  if p_accept then
    v_duration := coalesce(v_booking.estimated_minutes, 120);
    if public.has_booking_conflict(
      v_booking.tractor_id, v_booking.booking_date, v_booking.start_time,
      v_duration, v_booking.id
    ) then
      raise exception 'You already have a booking around this time. Resolve the schedule first.' using errcode = '23P01';
    end if;

    v_new_status := case when v_booking.booking_date > current_date then 'SCHEDULED'::public.booking_status else 'ACCEPTED'::public.booking_status end;
    update public.bookings set status = v_new_status where id = p_booking_id returning * into v_booking;
    perform public.add_history(p_booking_id, 'PENDING', 'ACCEPTED', v_uid, 'owner', 'Owner accepted the booking');
    if v_new_status = 'SCHEDULED' then
      perform public.add_history(p_booking_id, 'ACCEPTED', 'SCHEDULED', null, 'system', 'Booking scheduled for the agreed date');
    end if;
    select * into v_owner from public.profiles where id = v_uid;
    perform public.push_notification(
      v_booking.farmer_id,
      'Booking accepted',
      coalesce(v_owner.name, 'The owner') || ' accepted ' || v_booking.booking_number || '.',
      'booking',
      p_booking_id
    );
  else
    v_reason := coalesce(nullif(trim(p_reason), ''), 'Owner unavailable for this booking');
    update public.bookings set status = 'REJECTED' where id = p_booking_id returning * into v_booking;
    perform public.add_history(p_booking_id, 'PENDING', 'REJECTED', v_uid, 'owner', v_reason);
    perform public.push_notification(
      v_booking.farmer_id,
      'Booking not accepted',
      'The owner is unavailable for ' || v_booking.booking_number || '. You can send a new request.',
      'booking',
      p_booking_id
    );
  end if;

  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: cancel a pending, accepted or scheduled booking
-- ----------------------------------------------------------------------------
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_role public.user_role;
  v_new_status public.booking_status;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_booking.farmer_id <> v_uid and v_tractor.owner_id <> v_uid then
    raise exception 'You do not have access to this booking.' using errcode = '42501';
  end if;
  if v_booking.status not in ('PENDING', 'ACCEPTED', 'SCHEDULED') then
    raise exception 'This booking can no longer be cancelled normally.' using errcode = '22023';
  end if;

  v_role := case when v_booking.farmer_id = v_uid then 'farmer'::public.user_role else 'owner'::public.user_role end;
  v_new_status := case when v_role = 'farmer' then 'CANCELLED_BY_FARMER'::public.booking_status else 'CANCELLED_BY_OWNER'::public.booking_status end;
  v_reason := coalesce(nullif(trim(p_reason), ''), 'Cancelled by user');

  update public.bookings
  set status = v_new_status, cancelled_at = now(), cancellation_reason = v_reason, cancelled_by = v_uid
  where id = p_booking_id
  returning * into v_booking;

  perform public.add_history(p_booking_id, 'PENDING', v_new_status, v_uid, v_role::text, v_reason);
  perform public.push_notification(
    case when v_role = 'farmer' then v_tractor.owner_id else v_booking.farmer_id end,
    case when v_role = 'farmer' then 'Farmer cancelled a booking' else 'Owner cancelled a booking' end,
    'Booking ' || v_booking.booking_number || ' was cancelled.',
    'booking',
    p_booking_id
  );

  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: work lifecycle (owner only)
-- ----------------------------------------------------------------------------
create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_segments jsonb;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then raise exception 'Only the owner can start the job.' using errcode = '42501'; end if;
  if v_booking.status not in ('ACCEPTED', 'SCHEDULED') then raise exception 'This job cannot be started now.' using errcode = '22023'; end if;

  insert into public.work_sessions (booking_id, segments, total_minutes)
  values (p_booking_id, jsonb_build_array(jsonb_build_object('start', now(), 'end', null)), 0)
  on conflict (booking_id) do update
  set segments = public.work_sessions.segments || jsonb_build_array(jsonb_build_object('start', now(), 'end', null))
  returning segments into v_segments;

  update public.bookings set status = 'IN_PROGRESS', start_time = current_time where id = p_booking_id returning * into v_booking;
  perform public.add_history(p_booking_id, 'ACCEPTED', 'IN_PROGRESS', v_uid, 'owner', 'Owner started the job');
  perform public.push_notification(v_booking.farmer_id, 'Work started', 'Work has started on ' || v_booking.booking_number || '.', 'work', p_booking_id);
  return v_booking;
end;
$$;

create or replace function public.pause_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_segments jsonb;
  v_last jsonb;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then raise exception 'Only the owner can pause the job.' using errcode = '42501'; end if;
  if v_booking.status <> 'IN_PROGRESS' then raise exception 'Only active work can be paused.' using errcode = '22023'; end if;

  select segments into v_segments from public.work_sessions where booking_id = p_booking_id for update;
  v_last := v_segments -> (jsonb_array_length(v_segments) - 1);
  if v_last is not null and v_last ->> 'end' is null then
    v_segments := jsonb_set(v_segments, array[(jsonb_array_length(v_segments) - 1)::text, 'end'], to_jsonb(now()), true);
  end if;
  update public.work_sessions set segments = v_segments where booking_id = p_booking_id;

  update public.bookings set status = 'PAUSED' where id = p_booking_id returning * into v_booking;
  perform public.add_history(p_booking_id, 'IN_PROGRESS', 'PAUSED', v_uid, 'owner', 'Work paused');
  perform public.push_notification(v_booking.farmer_id, 'Work paused', 'Break time is not billed on ' || v_booking.booking_number || '.', 'work', p_booking_id);
  return v_booking;
end;
$$;

create or replace function public.resume_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then raise exception 'Only the owner can resume the job.' using errcode = '42501'; end if;
  if v_booking.status <> 'PAUSED' then raise exception 'This job is not paused.' using errcode = '22023'; end if;

  insert into public.work_sessions (booking_id, segments)
  values (p_booking_id, jsonb_build_array(jsonb_build_object('start', now(), 'end', null)))
  on conflict (booking_id) do update
  set segments = public.work_sessions.segments || jsonb_build_array(jsonb_build_object('start', now(), 'end', null));

  update public.bookings set status = 'IN_PROGRESS' where id = p_booking_id returning * into v_booking;
  perform public.add_history(p_booking_id, 'PAUSED', 'IN_PROGRESS', v_uid, 'owner', 'Owner resumed work');
  perform public.push_notification(v_booking.farmer_id, 'Work resumed', 'Work resumed on ' || v_booking.booking_number || '.', 'work', p_booking_id);
  return v_booking;
end;
$$;

create or replace function public.finish_booking(
  p_booking_id uuid,
  p_acres numeric default null,
  p_trips integer default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_owner public.profiles;
  v_segments jsonb;
  v_last jsonb;
  v_minutes integer;
  v_acres numeric;
  v_trips integer;
  v_amount integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then raise exception 'Only the owner can finish the job.' using errcode = '42501'; end if;
  if v_booking.status not in ('IN_PROGRESS', 'PAUSED') then raise exception 'This job cannot be finished from its current status.' using errcode = '22023'; end if;

  select segments into v_segments from public.work_sessions where booking_id = p_booking_id for update;
  v_last := v_segments -> (jsonb_array_length(v_segments) - 1);
  if v_last is not null and v_last ->> 'end' is null then
    v_segments := jsonb_set(v_segments, array[(jsonb_array_length(v_segments) - 1)::text, 'end'], to_jsonb(now()), true);
  end if;

  select coalesce(sum(
    greatest(0, round(extract(epoch from (
      coalesce((seg ->> 'end')::timestamptz, now()) - (seg ->> 'start')::timestamptz
    )) / 60))
  ), 0)::integer
  into v_minutes
  from jsonb_array_elements(v_segments) as seg;

  update public.work_sessions
  set segments = v_segments, total_minutes = v_minutes
  where booking_id = p_booking_id;

  if v_booking.pricing_type = 'hourly' then
    if v_minutes < 1 then raise exception 'At least one active minute is needed before finishing.' using errcode = '22023'; end if;
    v_acres := null;
    v_trips := null;
    v_amount := public.calculate_amount('hourly', v_booking.agreed_rate, v_minutes, null, null);
  elsif v_booking.pricing_type = 'acre' then
    v_acres := round(coalesce(p_acres, 0)::numeric, 1);
    if v_acres <= 0 or v_acres > 100 then raise exception 'Enter the completed acreage before finishing.' using errcode = '22023'; end if;
    v_trips := null;
    v_amount := public.calculate_amount('acre', v_booking.agreed_rate, null, v_acres, null);
  else
    v_trips := coalesce(p_trips, 0);
    if v_trips < 1 or v_trips > 20 then raise exception 'Enter the number of completed trips before finishing.' using errcode = '22023'; end if;
    v_acres := null;
    v_amount := public.calculate_amount('trip', v_booking.agreed_rate, null, null, v_trips);
  end if;

  insert into public.work_measurements (booking_id, completed_acres, completed_trips, billable_minutes)
  values (p_booking_id, v_acres, v_trips, case when v_booking.pricing_type = 'hourly' then v_minutes else null end)
  on conflict (booking_id) do update
  set completed_acres = excluded.completed_acres,
      completed_trips = excluded.completed_trips,
      billable_minutes = excluded.billable_minutes,
      created_at = now();

  update public.bookings
  set status = 'PAYMENT_PENDING', final_amount = v_amount
  where id = p_booking_id
  returning * into v_booking;

  perform public.add_history(p_booking_id, 'IN_PROGRESS', 'COMPLETION_PENDING', v_uid, 'owner', 'Work finished, final measurement recorded');
  perform public.add_history(p_booking_id, 'COMPLETION_PENDING', 'BILL_GENERATED', null, 'system', 'Final bill calculated');
  perform public.add_history(p_booking_id, 'BILL_GENERATED', 'PAYMENT_PENDING', null, 'system', 'Bill shared with farmer');

  select * into v_owner from public.profiles where id = v_uid;
  perform public.push_notification(
    v_booking.farmer_id,
    'Final bill ready',
    'Your final bill for ' || v_booking.booking_number || ' is Rs ' || v_amount || '. Pay ' || coalesce(v_owner.name, 'the owner') || ' directly.',
    'payment',
    p_booking_id
  );
  perform public.push_notification(
    v_uid,
    'Final bill generated',
    v_booking.booking_number || ' is ready for direct payment.',
    'payment',
    p_booking_id
  );

  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: owner marks a direct payment as received
-- Farmers never record payments in KisanTractor; they pay the owner directly.
-- ----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_booking_id uuid,
  p_method public.payment_method,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Only the tractor owner can mark payment done.' using errcode = '42501';
end;
$$;

create or replace function public.confirm_payment(
  p_booking_id uuid,
  p_method public.payment_method default null,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_owner public.profiles;
  v_payment public.payment_records;
  v_method public.payment_method;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;
  if v_tractor.owner_id <> v_uid then raise exception 'Only the owner can mark payment done.' using errcode = '42501'; end if;
  if v_booking.status <> 'PAYMENT_PENDING' then raise exception 'Payment cannot be marked done from this status.' using errcode = '22023'; end if;
  if v_booking.final_amount is null then raise exception 'The final bill is missing.' using errcode = '22023'; end if;

  select * into v_payment from public.payment_records
  where booking_id = p_booking_id and payment_status <> 'confirmed'
  order by created_at desc limit 1 for update;

  v_method := coalesce(p_method, v_payment.payment_method, 'upi');

  if v_payment.id is not null then
    update public.payment_records
    set payment_status = 'confirmed', confirmed_by = v_uid, confirmed_at = now(),
        amount = v_booking.final_amount, payment_method = v_method,
        notes = left(coalesce(p_notes, v_payment.notes), 300)
    where id = v_payment.id;
  else
    insert into public.payment_records (booking_id, amount, payment_method, payment_status, recorded_by, paid_at, confirmed_by, confirmed_at, notes)
    values (p_booking_id, v_booking.final_amount, v_method, 'confirmed', v_uid, now(), v_uid, now(), left(coalesce(p_notes, 'Owner marked payment done after receiving the money.'), 300));
  end if;

  update public.bookings set status = 'PAID' where id = p_booking_id returning * into v_booking;
  perform public.add_history(p_booking_id, 'PAYMENT_PENDING', 'PAID', v_uid, 'owner', 'Owner marked payment done');
  perform public.push_notification(v_booking.farmer_id, 'Payment marked done', 'The owner marked the payment for ' || v_booking.booking_number || ' as received.', 'payment', p_booking_id);

  update public.bookings set status = 'COMPLETED' where id = p_booking_id returning * into v_booking;
  perform public.add_history(p_booking_id, 'PAID', 'COMPLETED', null, 'system', 'Booking completed');
  perform public.push_notification(v_booking.farmer_id, 'Booking completed', v_booking.booking_number || ' is complete and saved in your history.', 'booking', p_booking_id);

  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: farmer shares live GPS for the owner's map and directions
-- ----------------------------------------------------------------------------
create or replace function public.share_farmer_location(
  p_booking_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy integer default null,
  p_sharing boolean default true
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_owner uuid;
  v_was_sharing boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  if v_booking.farmer_id <> v_uid then
    raise exception 'Only the farmer can share the farm location.' using errcode = '42501';
  end if;
  if v_booking.status not in ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETION_PENDING') then
    raise exception 'Live location can be shared only for an accepted or active booking.' using errcode = '22023';
  end if;

  select owner_id into v_owner from public.tractors where id = v_booking.tractor_id;
  v_was_sharing := v_booking.farmer_location is not null
    and coalesce((v_booking.farmer_location ->> 'sharing')::boolean, false);

  if not p_sharing then
    update public.bookings
    set farmer_location = null, updated_at = now()
    where id = p_booking_id
    returning * into v_booking;
    if v_was_sharing then
      perform public.push_notification(
        v_owner,
        'Live location sharing stopped',
        'The farmer stopped sharing live location for ' || v_booking.booking_number || '.',
        'system',
        p_booking_id
      );
    end if;
    return v_booking;
  end if;

  if p_lat is null or p_lng is null
    or p_lat < -90 or p_lat > 90
    or p_lng < -180 or p_lng > 180 then
    raise exception 'Please share a valid GPS location.' using errcode = '22023';
  end if;

  update public.bookings
  set farmer_location = jsonb_build_object(
        'lat', round(p_lat::numeric, 5),
        'lng', round(p_lng::numeric, 5),
        'accuracy', p_accuracy,
        'updatedAt', now(),
        'sharing', true
      ),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  if not v_was_sharing then
    perform public.push_notification(
      v_owner,
      'Farmer shared live location',
      'The farmer is sharing live location for ' || v_booking.booking_number || '. Open the booking to see the map and directions.',
      'system',
      p_booking_id
    );
  end if;
  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: dispute
-- ----------------------------------------------------------------------------
create or replace function public.raise_dispute(
  p_booking_id uuid,
  p_reason text,
  p_details text
)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_tractor public.tractors;
  v_role public.user_role;
  v_dispute public.disputes;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode = 'P0002'; end if;
  select * into v_tractor from public.tractors where id = v_booking.tractor_id;

  if v_booking.farmer_id = v_uid then
    v_role := 'farmer';
  elsif v_tractor.owner_id = v_uid then
    v_role := 'owner';
  else
    raise exception 'You do not have access to this booking.' using errcode = '42501';
  end if;

  if v_booking.status not in ('BILL_GENERATED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') then
    raise exception 'An issue can be reported after the final bill is ready.' using errcode = '22023';
  end if;
  if v_booking.status = 'COMPLETED' and v_booking.updated_at < now() - interval '7 days' then
    raise exception 'The support window for this completed booking has passed.' using errcode = '22023';
  end if;
  if trim(coalesce(p_reason, '')) = '' or trim(coalesce(p_details, '')) = '' then
    raise exception 'Please add a reason and details for the issue.' using errcode = '22023';
  end if;

  insert into public.disputes (booking_id, raised_by, raised_by_role, reason, details)
  values (p_booking_id, v_uid, v_role, left(p_reason, 120), left(p_details, 1000))
  returning * into v_dispute;

  update public.bookings set status = 'DISPUTED' where id = p_booking_id;
  perform public.add_history(p_booking_id, v_booking.status, 'DISPUTED', v_uid, v_role::text, left(p_reason, 120));
  perform public.push_notification(
    case when v_role = 'farmer' then v_tractor.owner_id else v_booking.farmer_id end,
    'Issue reported',
    'An issue was reported on ' || v_booking.booking_number || '. The original records are preserved.',
    'system',
    p_booking_id
  );

  return v_dispute;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: notifications
-- ----------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read = true
  where user_id = auth.uid()
    and (p_ids is null or id = any(p_ids));
$$;

-- ----------------------------------------------------------------------------
-- Grants: authenticated users can call the booking RPCs. They cannot write the
-- protected tables directly.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select on public.equipment, public.tractors, public.tractor_equipment, public.pricing to authenticated;
grant select on public.bookings, public.work_sessions, public.work_measurements,
  public.payment_records, public.booking_status_history, public.notifications,
  public.disputes, public.owner_payment_details to authenticated;
grant insert, update on public.notifications to authenticated;
grant execute on function public.create_booking(
  uuid, text, text, text, jsonb, public.service_type, public.pricing_type,
  date, time, integer, numeric, integer, text
) to authenticated;
grant execute on function public.respond_to_booking(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.start_booking(uuid) to authenticated;
grant execute on function public.pause_booking(uuid) to authenticated;
grant execute on function public.resume_booking(uuid) to authenticated;
grant execute on function public.finish_booking(uuid, numeric, integer) to authenticated;
grant execute on function public.record_payment(uuid, public.payment_method, text) to authenticated;
grant execute on function public.confirm_payment(uuid, public.payment_method, text) to authenticated;
grant execute on function public.raise_dispute(uuid, text, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Seed the equipment catalogue used by the booking wizard.
insert into public.equipment (id, name, description, icon) values
  ('eq_plough', 'Plough', 'Mouldboard plough for deep soil turning', 'plough'),
  ('eq_rotavator', 'Rotavator', 'Fine seedbed preparation', 'rotavator'),
  ('eq_trolley', 'Trolley', 'Local transport for harvest and supplies', 'trolley'),
  ('eq_seed_drill', 'Seed drill', 'Even row sowing', 'seed'),
  ('eq_sprayer', 'Sprayer', 'Field spraying equipment', 'spray')
on conflict (id) do nothing;
