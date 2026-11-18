-- Phase 9: plans, Google Play subscriptions, usage cost and the AI budget switch. Run after 0005. Safe to run again.

-- Plans: limits live in features (edit them in the Table Editor, no redeploy needed). The Google Play ids are set after the products exist in Play Console.
alter table public.plans
  add column if not exists play_product_id text,
  add column if not exists play_base_plan_id text,
  add column if not exists rank int not null default 0,
  add column if not exists sort_order int not null default 0;
create unique index if not exists plans_play_product_uidx on public.plans (play_product_id);

-- Starting limits. They only apply while a plan has no limits yet, so your own edits are never overwritten.
update public.plans set rank = 0, sort_order = 1, features = '{"ai_turns_per_day":10,"stt_seconds_per_day":120,"speaking_modes":["guided","repeat","answer","review"]}'::jsonb where id = 'free' and features = '{}'::jsonb;
update public.plans set rank = 1, sort_order = 2, features = '{"ai_turns_per_day":40,"stt_seconds_per_day":600,"speaking_modes":["guided","roleplay","free","repeat","answer","review"]}'::jsonb where id = 'pro' and features = '{}'::jsonb;
update public.plans set rank = 2, sort_order = 3, features = '{"ai_turns_per_day":100,"stt_seconds_per_day":1500,"speaking_modes":["guided","roleplay","free","repeat","answer","review"]}'::jsonb where id = 'advanced' and features = '{}'::jsonb;

-- More detail about each subscription (the table itself comes from 0001). provider is 'google_play' or 'manual' (a gift or test account you add yourself).
alter table public.subscriptions
  add column if not exists product_id text,
  add column if not exists store_state text,
  add column if not exists latest_order_id text,
  add column if not exists auto_renew boolean,
  add column if not exists acknowledged boolean not null default false,
  add column if not exists is_test boolean not null default false,
  add column if not exists started_at timestamptz,
  add column if not exists last_verified_at timestamptz;

-- A random id per learner that is sent to Google Play with each purchase. It lets a purchase be matched to the right learner without sharing any personal data.
create table if not exists public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  obfuscated_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
-- no policies on purpose: only the server (service role) can read or write it.

-- What each AI or voice call cost, when prices are configured on the server.
alter table public.usage_ledger add column if not exists cost_usd numeric(12,6);
create index if not exists usage_type_time_idx on public.usage_ledger (usage_type, created_at);

-- Switches for the owner: ai_enabled turns the AI coach off for everyone; the budgets stop AI calls when the estimated spend is reached.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values ('ai_enabled', 'true'::jsonb), ('ai_daily_budget_usd', 'null'::jsonb), ('ai_monthly_budget_usd', 'null'::jsonb) on conflict (key) do nothing;

-- Totals for budget checks and monitoring. Only the server can call these.
create or replace function public.usage_cost_since(since timestamptz) returns numeric language sql stable as
$$ select coalesce(sum(cost_usd), 0) from public.usage_ledger where created_at >= since $$;
create or replace function public.usage_totals(since timestamptz) returns table (usage_type text, quantity numeric, cost_usd numeric, users bigint) language sql stable as
$$ select u.usage_type, sum(u.quantity), coalesce(sum(u.cost_usd), 0), count(distinct u.user_id) from public.usage_ledger u where u.created_at >= since group by u.usage_type $$;
create or replace function public.subscription_counts() returns table (plan_id text, status text, store_state text, n bigint) language sql stable as
$$ select s.plan_id, s.status, s.store_state, count(*) from public.subscriptions s group by s.plan_id, s.status, s.store_state $$;
revoke all on function public.usage_cost_since(timestamptz), public.usage_totals(timestamptz), public.subscription_counts() from public, anon, authenticated;
grant execute on function public.usage_cost_since(timestamptz), public.usage_totals(timestamptz), public.subscription_counts() to service_role;
