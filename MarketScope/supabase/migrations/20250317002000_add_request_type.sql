-- Тип запроса клиента (2 режима из DATA_FLOW.md):
-- - market_overview: обзор рынка
-- - competitive_analysis: конкурентный анализ

alter table public.client_requests
  add column if not exists request_type text not null default 'market_overview';

create index if not exists idx_client_requests_request_type on public.client_requests(request_type);

