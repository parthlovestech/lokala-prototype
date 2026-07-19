-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
-- Adds support for: business QR codes, and customer self-reported amount + tip logging.

-- ─────────────────────────────────────────────
-- 1. businesses
-- One row per business. owner_id is the Supabase auth user who manages it.
-- The QR code encodes this row's `id`, so no separate code column is needed.
-- ─────────────────────────────────────────────
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- One business per owner for now (simplest case — remove this if an owner
-- should be able to run multiple locations later).
create unique index if not exists businesses_owner_id_unique on businesses(owner_id);

alter table businesses enable row level security;

-- Anyone signed in can look up a business by id (needed when a customer scans
-- a QR code and we fetch the business name). Only name/id are sensitive-free.
drop policy if exists "businesses_select_all" on businesses;
create policy "businesses_select_all"
  on businesses for select
  using (auth.role() = 'authenticated');

-- Only the owner can create/update/delete their own business row.
drop policy if exists "businesses_owner_insert" on businesses;
create policy "businesses_owner_insert"
  on businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "businesses_owner_update" on businesses;
create policy "businesses_owner_update"
  on businesses for update
  using (auth.uid() = owner_id);

drop policy if exists "businesses_owner_delete" on businesses;
create policy "businesses_owner_delete"
  on businesses for delete
  using (auth.uid() = owner_id);


-- ─────────────────────────────────────────────
-- 2. tips
-- One row per customer "check-in": the amount they say they paid + tip.
-- This does NOT move money — it's a self-reported log for the business's
-- own analytics/dashboard, confirmed on-screen so staff can glance at it.
-- ─────────────────────────────────────────────
create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  business_name text not null,        -- snapshot, so history reads fine even if the name changes later
  subtotal numeric(10,2) not null check (subtotal >= 0),
  tip_percent numeric(5,2),           -- null when a custom dollar tip was used instead of a %
  tip_amount numeric(10,2) not null default 0 check (tip_amount >= 0),
  total numeric(10,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists tips_business_id_idx on tips(business_id);
create index if not exists tips_user_id_idx on tips(user_id);

alter table tips enable row level security;

-- Customers can insert their own tip record.
drop policy if exists "tips_customer_insert" on tips;
create policy "tips_customer_insert"
  on tips for insert
  with check (auth.uid() = user_id);

-- Customers can see their own history.
drop policy if exists "tips_customer_select_own" on tips;
create policy "tips_customer_select_own"
  on tips for select
  using (auth.uid() = user_id);

-- Business owners can see all tips logged against their business (for the dashboard).
drop policy if exists "tips_owner_select" on tips;
create policy "tips_owner_select"
  on tips for select
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
