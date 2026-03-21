alter table public.technical_analysis
  add column if not exists reference_conclusion text not null default '';

