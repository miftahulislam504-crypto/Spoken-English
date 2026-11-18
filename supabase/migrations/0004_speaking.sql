-- Phase 7: AI speaking support. Run after 0003.
alter table public.conversation_sessions add column if not exists mode text check (mode in ('guided','roleplay','free','repeat','answer','review'));
alter table public.conversation_turns add column if not exists kind text check (kind in ('reply','repeat','retry'));
alter table public.conversation_turns add column if not exists idempotency_key text;
-- A retried turn with the same key is never processed twice.
create unique index if not exists conv_turns_idem_idx on public.conversation_turns (session_id, idempotency_key) where idempotency_key is not null;
create index if not exists mistakes_corrected_idx on public.mistake_records (user_id, corrected_text);
