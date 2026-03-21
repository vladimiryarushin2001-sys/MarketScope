-- Исправление рассинхрона identity/sequence (ошибка duplicate key on id при insert без id).
-- Запускайте один раз, если получаете "Key (id)=(1) already exists".

select setval(pg_get_serial_sequence('public.restaurants', 'id'), (select coalesce(max(id), 0) + 1 from public.restaurants), false);
select setval(pg_get_serial_sequence('public.menus', 'id'), (select coalesce(max(id), 0) + 1 from public.menus), false);
select setval(pg_get_serial_sequence('public.menu_items', 'id'), (select coalesce(max(id), 0) + 1 from public.menu_items), false);
select setval(pg_get_serial_sequence('public.reviews', 'id'), (select coalesce(max(id), 0) + 1 from public.reviews), false);
select setval(pg_get_serial_sequence('public.marketing', 'id'), (select coalesce(max(id), 0) + 1 from public.marketing), false);
select setval(pg_get_serial_sequence('public.marketing_socials', 'id'), (select coalesce(max(id), 0) + 1 from public.marketing_socials), false);
select setval(pg_get_serial_sequence('public.marketing_loyalty', 'id'), (select coalesce(max(id), 0) + 1 from public.marketing_loyalty), false);
select setval(pg_get_serial_sequence('public.technical_analysis', 'id'), (select coalesce(max(id), 0) + 1 from public.technical_analysis), false);
select setval(pg_get_serial_sequence('public.strategic_report', 'id'), (select coalesce(max(id), 0) + 1 from public.strategic_report), false);
select setval(pg_get_serial_sequence('public.client_requests', 'id'), (select coalesce(max(id), 0) + 1 from public.client_requests), false);
select setval(pg_get_serial_sequence('public.analysis_runs', 'id'), (select coalesce(max(id), 0) + 1 from public.analysis_runs), false);

