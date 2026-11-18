-- Row-level security and least-privilege grants (plan sections 10 and 15).
-- The mobile app only ever holds the public anon key and the learner's own token.
-- Writes to attempts, sessions, subscriptions and usage go through the server (service role).

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.exercise_attempts enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_turns enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.mistake_records enable row level security;
alter table public.review_queue enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.webhook_events enable row level security;

-- Start from no access, then grant only what is needed.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

grant select on public.courses, public.lessons, public.plans to authenticated;
-- Answer rules are never readable by the app: column list leaves out answer_rules_json.
grant select (id, lesson_id, position, stage, exercise_type, content_json, difficulty, scored, content_version) on public.exercises to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, explanation_language, current_level, daily_goal_minutes, preferences) on public.profiles to authenticated;
grant select, insert, update on public.user_lesson_progress to authenticated;
grant select on public.exercise_attempts, public.conversation_sessions, public.conversation_turns, public.skill_assessments,
  public.mistake_records, public.review_queue, public.subscriptions, public.usage_ledger to authenticated;

drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated using (published_status = 'published');
drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated using (published_status = 'published');
drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = exercises.lesson_id and l.published_status = 'published'));
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (true);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists progress_select on public.user_lesson_progress;
create policy progress_select on public.user_lesson_progress for select to authenticated using (user_id = auth.uid());
drop policy if exists progress_insert on public.user_lesson_progress;
create policy progress_insert on public.user_lesson_progress for insert to authenticated with check (user_id = auth.uid());
drop policy if exists progress_update on public.user_lesson_progress;
create policy progress_update on public.user_lesson_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists attempts_select on public.exercise_attempts;
create policy attempts_select on public.exercise_attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists sessions_select on public.conversation_sessions;
create policy sessions_select on public.conversation_sessions for select to authenticated using (user_id = auth.uid());
drop policy if exists turns_select on public.conversation_turns;
create policy turns_select on public.conversation_turns for select to authenticated
  using (exists (select 1 from public.conversation_sessions s where s.id = conversation_turns.session_id and s.user_id = auth.uid()));
drop policy if exists assess_select on public.skill_assessments;
create policy assess_select on public.skill_assessments for select to authenticated using (user_id = auth.uid());
drop policy if exists mistakes_select on public.mistake_records;
create policy mistakes_select on public.mistake_records for select to authenticated using (user_id = auth.uid());
drop policy if exists review_select on public.review_queue;
create policy review_select on public.review_queue for select to authenticated using (user_id = auth.uid());
drop policy if exists subs_select on public.subscriptions;
create policy subs_select on public.subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists usage_select on public.usage_ledger;
create policy usage_select on public.usage_ledger for select to authenticated using (user_id = auth.uid());
-- webhook_events: no policy on purpose. Only the server (service role) can touch it.
