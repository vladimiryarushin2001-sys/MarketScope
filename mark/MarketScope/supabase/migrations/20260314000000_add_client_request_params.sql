-- Add params payload for client requests (mode-specific fields)
alter table public.client_requests
add column if not exists params jsonb not null default '{}'::jsonb;

