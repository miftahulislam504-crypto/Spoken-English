-- Phase 10: admin roles, audit log, usage analytics, content history and feedback reports. Run after 0006. Safe to run again.
-- Nothing here is readable by the app token: every table has row-level security on and no policy, so only the server (service role) can use them.

-- Who may use the admin dashboard. The first owner is added by hand (see docs/admin.md); after that owners manage the team in the dashboard.
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','content_manager','support','analyst')),
  email text,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.admin_roles enable row level security;

-- Every admin change, written before the change is made. Rows can never be edited or deleted.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  "at" timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_at_idx on public.audit_log ("at" desc);
create index if not exists audit_target_idx on public.audit_log (target_type, target_id);
alter table public.audit_log enable row level security;
create or replace function public.audit_log_append_only() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists trg_audit_immutable on public.audit_log;
create trigger trg_audit_immutable before update or delete on public.audit_log for each row execute function public.audit_log_append_only();

-- Usage events from the app (names and values come from a fixed list; see docs/analytics-events.md). install_id is a random id made on the phone.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  "at" timestamptz not null default now(),
  client_at timestamptz,
  install_id text not null check (char_length(install_id) between 16 and 64),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) <= 40),
  props jsonb not null default '{}'::jsonb,
  platform text check (platform in ('web','android')),
  app_version text check (char_length(app_version) <= 20)
);
create index if not exists events_at_idx on public.analytics_events ("at");
create index if not exists events_name_idx on public.analytics_events (name, "at");
create index if not exists events_install_idx on public.analytics_events (install_id, "at");
create index if not exists events_user_idx on public.analytics_events (user_id) where user_id is not null;
alter table public.analytics_events enable row level security;

-- Earlier versions of lessons, kept when an admin edits, so a change can be undone.
create table if not exists public.content_revisions (
  id bigint generated always as identity primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  content_version int not null,
  snapshot jsonb not null,
  reason text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists revisions_lesson_idx on public.content_revisions (lesson_id, id desc);
alter table public.content_revisions enable row level security;

-- Problems and ideas sent from the app, including "report this correction" from AI Speak.
create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  install_id text,
  kind text not null check (kind in ('bug','content_error','ai_correction','idea','other')),
  message text not null check (char_length(message) between 1 and 1000),
  context jsonb not null default '{}'::jsonb,
  app_version text,
  platform text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback_reports (status, created_at desc);
alter table public.feedback_reports enable row level security;
drop trigger if exists trg_feedback_updated on public.feedback_reports;
create trigger trg_feedback_updated before update on public.feedback_reports for each row execute function public.set_updated_at();

-- ---- functions for the dashboard (only the server can call them) ----
-- Find a learner by exact email or by id (the email lives in Supabase Auth, which the API cannot query directly).
create or replace function public.admin_find_user(p_query text) returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as
$$ select u.id, u.email::text, u.created_at, u.last_sign_in_at from auth.users u
   where lower(u.email) = lower(trim(p_query)) or u.id::text = trim(p_query) limit 5 $$;

-- Events per day: how many events and how many different phones. Days follow the quota time zone offset (minutes, default Bangladesh).
create or replace function public.analytics_daily(p_since timestamptz, p_offset int default 360) returns table (day date, name text, events bigint, actors bigint)
language sql stable as
$$ select ((e."at" at time zone 'UTC') + make_interval(mins => p_offset))::date, e.name, count(*), count(distinct e.install_id)
   from public.analytics_events e where e."at" >= p_since group by 1, 2 order by 1, 2 $$;

-- Events across the whole period: different phones that did each thing at least once (used for the funnel).
create or replace function public.analytics_totals(p_since timestamptz) returns table (name text, events bigint, actors bigint)
language sql stable as
$$ select e.name, count(*), count(distinct e.install_id) from public.analytics_events e where e."at" >= p_since group by 1 order by 1 $$;

-- Retention: of the phones that opened the app for the first time on a day, how many opened it again 1 and 7 days later.
create or replace function public.analytics_retention(p_since timestamptz, p_offset int default 360) returns table (cohort date, size bigint, d1 bigint, d7 bigint)
language sql stable as
$$ with d as (
     select install_id, (("at" at time zone 'UTC') + make_interval(mins => p_offset))::date as day from public.analytics_events where name = 'app_opened' group by 1, 2),
   f as (select install_id, min(day) as first_day from d group by 1)
   select f.first_day, count(*),
     count(*) filter (where exists (select 1 from d x where x.install_id = f.install_id and x.day = f.first_day + 1)),
     count(*) filter (where exists (select 1 from d x where x.install_id = f.install_id and x.day = f.first_day + 7))
   from f where f.first_day >= ((p_since at time zone 'UTC') + make_interval(mins => p_offset))::date group by 1 order by 1 $$;

-- Product numbers from the real tables (learners, practice, speaking). Phone-reported practice counts are labelled as such in the dashboard.
create or replace function public.product_metrics(p_since timestamptz, p_offset int default 360) returns jsonb
language sql stable as
$$ select jsonb_build_object(
  'learners_total', (select count(*) from public.profiles),
  'learners_new', (select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'n', x.n) order by x.day), '[]'::jsonb) from (select ((created_at at time zone 'UTC') + make_interval(mins => p_offset))::date as day, count(*) as n from public.profiles where created_at >= p_since group by 1) x),
  'practicing_per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'n', x.n) order by x.day), '[]'::jsonb) from (select day, count(*) as n from public.daily_activity where day >= ((p_since at time zone 'UTC') + make_interval(mins => p_offset))::date and coalesce((data->>'sec')::numeric, 0) > 0 group by day) x),
  'lessons_completed', (select coalesce(jsonb_agg(jsonb_build_object('day', x.day, 'n', x.n) order by x.day), '[]'::jsonb) from (select ((completed_at at time zone 'UTC') + make_interval(mins => p_offset))::date as day, count(*) as n from public.user_lesson_progress where status = 'completed' and placed = false and completed_at >= p_since group by 1) x),
  'sessions', (select jsonb_build_object('total', count(*), 'ended', count(*) filter (where session_status = 'ended'), 'abandoned', count(*) filter (where session_status = 'abandoned'), 'failed', count(*) filter (where session_status = 'failed'), 'learners', count(distinct user_id)) from public.conversation_sessions where started_at >= p_since),
  'sessions_by_mode', (select coalesce(jsonb_object_agg(x.mode, x.n), '{}'::jsonb) from (select coalesce(mode, 'unknown') as mode, count(*) as n from public.conversation_sessions where started_at >= p_since group by 1) x),
  'learner_turns', (select count(*) from public.conversation_turns where speaker = 'learner' and created_at >= p_since),
  'open_mistakes', (select count(*) from public.mistake_records where resolved_at is null),
  'feedback_new', (select count(*) from public.feedback_reports where status = 'new')
) $$;

revoke all on function public.admin_find_user(text), public.analytics_daily(timestamptz, int), public.analytics_totals(timestamptz), public.analytics_retention(timestamptz, int), public.product_metrics(timestamptz, int) from public, anon, authenticated;
grant execute on function public.admin_find_user(text), public.analytics_daily(timestamptz, int), public.analytics_totals(timestamptz), public.analytics_retention(timestamptz, int), public.product_metrics(timestamptz, int) to service_role;
