-- Phase 11: saved words in the account, data retention and the settings that control it. Run after 0007. Safe to run again.

-- Saved words and phrases (the phrasebook), so a new phone gets them back and they are part of "download my data".
create table if not exists public.saved_words (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 80),
  en text not null check (char_length(en) between 1 and 120),
  bn text check (char_length(bn) <= 200),
  example text check (char_length(example) <= 300),
  custom boolean not null default false,
  in_review boolean not null default false,
  seen int not null default 0 check (seen >= 0),
  seen_correct int not null default 0 check (seen_correct >= 0),
  used int not null default 0 check (used >= 0),
  used_correct int not null default 0 check (used_correct >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
drop trigger if exists trg_saved_words_updated on public.saved_words;
create trigger trg_saved_words_updated before update on public.saved_words for each row execute function public.set_updated_at();
alter table public.saved_words enable row level security;
grant select on public.saved_words to authenticated;
drop policy if exists saved_words_select on public.saved_words;
create policy saved_words_select on public.saved_words for select to authenticated using (user_id = auth.uid());

-- How long things are kept. Edit the numbers in the Table Editor (app_settings); the nightly job reads them.
insert into public.app_settings (key, value) values
  ('retention_analytics_days', '180'::jsonb),
  ('retention_transcript_days', '90'::jsonb),
  ('retention_webhook_days', '180'::jsonb),
  ('retention_feedback_days', '365'::jsonb)
on conflict (key) do nothing;

-- The nightly clean-up. Returns how many rows were removed from each place.
create or replace function public.run_retention(p_analytics_days int, p_transcript_days int, p_webhook_days int, p_feedback_days int) returns jsonb
language plpgsql as $$
declare a bigint; t bigint; s bigint; w bigint; f bigint;
begin
  delete from public.analytics_events where "at" < now() - make_interval(days => p_analytics_days); get diagnostics a = row_count;
  delete from public.conversation_turns where created_at < now() - make_interval(days => p_transcript_days); get diagnostics t = row_count;
  update public.conversation_sessions set summary = null where summary is not null and started_at < now() - make_interval(days => p_transcript_days); get diagnostics s = row_count;
  delete from public.webhook_events where processed_at is not null and created_at < now() - make_interval(days => p_webhook_days); get diagnostics w = row_count;
  delete from public.feedback_reports where status in ('resolved','dismissed') and updated_at < now() - make_interval(days => p_feedback_days); get diagnostics f = row_count;
  return jsonb_build_object('analytics_events', a, 'conversation_turns', t, 'session_summaries', s, 'webhook_events', w, 'feedback_reports', f);
end $$;
revoke all on function public.run_retention(int, int, int, int) from public, anon, authenticated;
grant execute on function public.run_retention(int, int, int, int) to service_role;
