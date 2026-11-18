-- Phase 8: mistakes, review schedule, listening results and daily practice log. Run after 0004.
-- Safe to run again.

-- Mistake records now carry where the mistake came from and the Bengali explanation.
alter table public.mistake_records
  add column if not exists client_id text,
  add column if not exists kind text not null default 'speaking' check (kind in ('speaking','step','note')),
  add column if not exists ref text,
  add column if not exists skill text,
  add column if not exists prompt text,
  add column if not exists explanation_bn text,
  add column if not exists alternative_text text,
  add column if not exists resolved_by text check (resolved_by in ('review','learner'));

-- Older speaking corrections get the same key the app and the server use: 'sp:' + the corrected sentence, lower case, letters, digits and apostrophes only.
with k as (
  select id, 'sp:' || trim(regexp_replace(regexp_replace(lower(corrected_text), '[^a-z0-9'' ]+', ' ', 'g'), '\s+', ' ', 'g')) as cid,
         row_number() over (partition by user_id, trim(regexp_replace(regexp_replace(lower(corrected_text), '[^a-z0-9'' ]+', ' ', 'g'), '\s+', ' ', 'g')) order by last_seen_at desc) as rn
  from public.mistake_records where client_id is null and corrected_text is not null
)
update public.mistake_records m set client_id = k.cid, skill = coalesce(m.skill, 'speaking') from k where m.id = k.id and k.rn = 1;

create unique index if not exists mistakes_client_uidx on public.mistake_records (user_id, client_id);

-- Review schedule details (the table itself comes from 0001).
alter table public.review_queue
  add column if not exists box int not null default 0 check (box between 0 and 5),
  add column if not exists reps int not null default 0 check (reps >= 0),
  add column if not exists lapses int not null default 0 check (lapses >= 0),
  add column if not exists last_reviewed_at timestamptz;

create table if not exists public.listening_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  attempts int not null default 0 check (attempts >= 0),
  best_score int not null default 0 check (best_score between 0 and 100),
  last_score int not null default 0 check (last_score between 0 and 100),
  last_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- One row per learner and day. data holds the counts shown in Progress and the Weekly Report.
create table if not exists public.daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

drop trigger if exists trg_listening_updated on public.listening_progress;
create trigger trg_listening_updated before update on public.listening_progress for each row execute function public.set_updated_at();
drop trigger if exists trg_activity_updated on public.daily_activity;
create trigger trg_activity_updated before update on public.daily_activity for each row execute function public.set_updated_at();

-- Same rules as the other learner tables: the learner reads only their own rows, and the server writes.
alter table public.listening_progress enable row level security;
alter table public.daily_activity enable row level security;
grant select on public.listening_progress, public.daily_activity to authenticated;
drop policy if exists listening_select on public.listening_progress;
create policy listening_select on public.listening_progress for select to authenticated using (user_id = auth.uid());
drop policy if exists activity_select on public.daily_activity;
create policy activity_select on public.daily_activity for select to authenticated using (user_id = auth.uid());
