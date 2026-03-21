-- Reference-level conclusions for block-level pages
alter table public.marketing
  add column if not exists reference_conclusion text not null default '';

alter table public.menus
  add column if not exists reference_conclusion text not null default '';

