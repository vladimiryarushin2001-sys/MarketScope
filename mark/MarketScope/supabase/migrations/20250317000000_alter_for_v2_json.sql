-- Поддержка нового формата JSON (v2 / temp2):
-- - дополнительные поля в restaurants
-- - activity в marketing_socials
-- - marketing_loyalty: loyalty_format -> text[], loyalty_cost_per_point -> text

-- 1) restaurants: дополнительные поля из block1
alter table public.restaurants
  add column if not exists yandex_maps_link text not null default '',
  add column if not exists menu_url text not null default '',
  add column if not exists menu_files text[] not null default '{}',
  add column if not exists is_reference_place boolean not null default false;

-- 2) marketing_socials: activity
alter table public.marketing_socials
  add column if not exists activity text not null default '';

-- 3) marketing_loyalty: меняем типы без потери совместимости
do $$
begin
  -- если миграция уже применялась (колонки переименованы), не делаем ничего
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_loyalty'
      and column_name = 'loyalty_format'
      and data_type = 'ARRAY'
  ) then
    return;
  end if;

  -- добавляем новые колонки
  alter table public.marketing_loyalty
    add column if not exists loyalty_format_arr text[] not null default '{}',
    add column if not exists loyalty_cost_per_point_text text not null default '';

  -- переносим данные из старых колонок (если они есть)
  update public.marketing_loyalty
  set
    loyalty_format_arr = case
      when coalesce(loyalty_format, '') = '' then '{}'
      else string_to_array(loyalty_format, ',')
    end,
    loyalty_cost_per_point_text = coalesce(loyalty_cost_per_point::text, '');

  -- удаляем старые колонки и переименовываем новые
  alter table public.marketing_loyalty
    drop column if exists loyalty_format,
    drop column if exists loyalty_cost_per_point;

  alter table public.marketing_loyalty
    rename column loyalty_format_arr to loyalty_format;

  alter table public.marketing_loyalty
    rename column loyalty_cost_per_point_text to loyalty_cost_per_point;
end $$;

