-- Extend reviews table with enriched metrics/details from block3_reviews_enriched
alter table public.reviews
  add column if not exists rating numeric not null default 0,
  add column if not exists count_rating int not null default 0,
  add column if not exists positive_reviews text[] not null default '{}',
  add column if not exists negative_reviews text[] not null default '{}',
  add column if not exists reference_conclusion text not null default '';

