-- Spoken English app: database schema (plan section 10).
-- Identity: Supabase Auth. public.profiles.id = auth.users.id (the plan's "users" entity).
-- Run in the Supabase SQL editor, then run 0002_rls.sql and the seed file.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  native_language text not null default 'bn',
  ui_locale text not null default 'en' check (ui_locale = 'en'),
  explanation_language text not null default 'bn' check (explanation_language in ('bn','en')),
  target_language text not null default 'en' check (target_language = 'en'),
  current_level text not null default 'Pre-A1' check (current_level in ('Pre-A1','A1','A2','B1','B2','Advanced')),
  daily_goal_minutes int not null default 10 check (daily_goal_minutes between 1 and 240),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  title text not null,
  description text,
  level text not null,
  published_status text not null default 'draft' check (published_status in ('draft','published','archived')),
  content_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  title_en text not null,
  level text not null,
  sequence_number int not null,
  week text,
  learning_objectives text[] not null default '{}',
  prerequisite_lesson_ids text[] not null default '{}',
  estimated_duration_seconds int not null default 600,
  completion_min_score numeric(4,3) not null default 0.6 check (completion_min_score between 0 and 1),
  is_assessment boolean not null default false,
  content_json jsonb not null default '[]'::jsonb,
  content_version int not null default 1,
  published_status text not null default 'draft' check (published_status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_course_seq_idx on public.lessons (course_id, sequence_number);

create table if not exists public.exercises (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  position int not null,
  stage text,
  exercise_type text not null check (exercise_type in ('choose','listen_choose','order','type','pattern')),
  content_json jsonb not null,
  answer_rules_json jsonb not null,
  difficulty int not null default 1 check (difficulty between 1 and 5),
  scored boolean not null default true,
  content_version int not null default 1,
  unique (lesson_id, position)
);

create table if not exists public.user_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  status text not null check (status in ('in_progress','completed')),
  attempt_count int not null default 0 check (attempt_count >= 0),
  score numeric(4,3) not null default 0 check (score between 0 and 1),
  mastery_score numeric(4,3) not null default 0 check (mastery_score between 0 and 1),
  content_version int not null default 1,
  placed boolean not null default false,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  lesson_id text not null,
  answer_json jsonb,
  is_correct boolean not null,
  attempt_number int not null default 1,
  idempotency_key text not null,
  result_json jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists exercise_attempts_user_ex_idx on public.exercise_attempts (user_id, exercise_id);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_id text,
  level_at_start text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  session_status text not null default 'active' check (session_status in ('active','ended','abandoned','failed'))
);
create index if not exists conv_sessions_user_idx on public.conversation_sessions (user_id, started_at desc);

create table if not exists public.conversation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  speaker text not null check (speaker in ('learner','coach')),
  transcript text,
  feedback_json jsonb,
  audio_reference text,
  created_at timestamptz not null default now()
);
create index if not exists conv_turns_session_idx on public.conversation_turns (session_id, created_at);

create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_type text not null check (skill_type in ('listening','speaking','vocabulary','sentence','grammar','pronunciation')),
  score numeric(5,2),
  confidence text not null default 'low' check (confidence in ('none','low','medium','high')),
  evidence_json jsonb,
  assessed_at timestamptz not null default now(),
  assessment_version int not null default 1
);
create index if not exists skill_assess_user_idx on public.skill_assessments (user_id, skill_type, assessed_at desc);

create table if not exists public.mistake_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  error_type text not null,
  original_text text,
  corrected_text text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count int not null default 1,
  resolved_at timestamptz
);
create index if not exists mistakes_user_idx on public.mistake_records (user_id, last_seen_at desc);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_reference text not null,
  review_type text not null,
  due_at timestamptz not null default now(),
  interval_days int not null default 1,
  last_result text,
  updated_at timestamptz not null default now(),
  unique (user_id, content_reference, review_type)
);
create index if not exists review_due_idx on public.review_queue (user_id, due_at);

create table if not exists public.plans (
  id text primary key,
  name text not null,
  features jsonb not null default '{}'::jsonb
);
insert into public.plans (id, name) values ('free','Free - Starter'), ('pro','Pro - Regular practice'), ('advanced','Advanced - Intensive practice') on conflict (id) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  provider text not null,
  provider_reference text not null,
  status text not null check (status in ('active','trialing','past_due','canceled','expired')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index if not exists subs_user_idx on public.subscriptions (user_id);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_type text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists usage_user_idx on public.usage_ledger (user_id, created_at desc);

-- Payment webhooks: one row per provider event so retries are processed once.
create table if not exists public.webhook_events (
  provider text not null,
  event_id text not null,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- Triggers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_courses_updated on public.courses;
create trigger trg_courses_updated before update on public.courses for each row execute function public.set_updated_at();
drop trigger if exists trg_lessons_updated on public.lessons;
create trigger trg_lessons_updated before update on public.lessons for each row execute function public.set_updated_at();
drop trigger if exists trg_progress_updated on public.user_lesson_progress;
create trigger trg_progress_updated before update on public.user_lesson_progress for each row execute function public.set_updated_at();
drop trigger if exists trg_review_updated on public.review_queue;
create trigger trg_review_updated before update on public.review_queue for each row execute function public.set_updated_at();
drop trigger if exists trg_subs_updated on public.subscriptions;
create trigger trg_subs_updated before update on public.subscriptions for each row execute function public.set_updated_at();

-- Progress never goes backwards: a completed lesson stays completed and counters only grow.
create or replace function public.keep_progress() returns trigger language plpgsql as $$
begin
  if old.status = 'completed' and new.status <> 'completed' then
    new.status := old.status; new.completed_at := old.completed_at;
  end if;
  new.attempt_count := greatest(old.attempt_count, new.attempt_count);
  new.mastery_score := greatest(old.mastery_score, new.mastery_score);
  return new;
end $$;
drop trigger if exists trg_progress_keep on public.user_lesson_progress;
create trigger trg_progress_keep before update on public.user_lesson_progress for each row execute function public.keep_progress();

-- Every new auth user gets a profile.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, nullif(left(new.raw_user_meta_data->>'display_name', 80), '')) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
