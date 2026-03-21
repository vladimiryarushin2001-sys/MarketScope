-- Демо-данные для дашборда (те же, что в mockData). Выполните после создания таблиц.

insert into public.restaurants (id, name, address, type, cuisine, avg_check, description, link, cosine_score, site, delivery, working_hours)
overriding system value
values
  (1, 'Ruski', 'Москва-Сити, Пресненская наб., 12', 'Панорамный ресторан', 'Русская', 2500, 'Панорамный ресторан русской кухни в Москва-Сити.', 'https://ruski.com', 0.95, 'https://ruski.com', true, '10:00-23:00'),
  (2, 'Birds', 'Москва-Сити, Пресненская наб., 12', 'Бар-ресторан', 'Европейская', 1800, 'Бар с шоу-программой и коктейлями.', 'https://birds.moscow', 0.89, 'https://birds.moscow', false, '12:00-02:00')
on conflict (id) do nothing;

insert into public.menus (id, restaurant_id, status, menu_urls, items_count, has_kids_menu, categories)
overriding system value
values
  (1, 1, 'parsed', '{"https://ruski.com/menu.pdf"}', 3, true, '{"Основные блюда","Десерты","Напитки"}'),
  (2, 2, 'parsed', '{"https://birds.moscow/menu.pdf"}', 2, false, '{"Бар","Основные блюда"}')
on conflict (id) do nothing;

insert into public.menu_items (id, menu_id, category, name, price)
overriding system value
values
  (1, 1, 'Основные блюда', 'Борщ', 450),
  (2, 1, 'Десерты', 'Медовик', 350),
  (3, 1, 'Напитки', 'Морс', 200),
  (4, 2, 'Бар', 'Коктейль Birds', 700),
  (5, 2, 'Основные блюда', 'Стейк', 1200)
on conflict (id) do nothing;

insert into public.reviews (id, restaurant_id, summary_mode, reviews_count, general_info, positive, negative)
overriding system value
values
  (1, 1, 'perplexity', 132, 'Гости отмечают панорамный вид и сильную кухню, жалобы на ожидание в пиковые часы.', 'Панорамный вид; Сильные десерты; Запоминающаяся атмосфера', 'Ожидание горячих блюд; Высокий шум при полной посадке'),
  (2, 2, 'perplexity', 88, 'Конкурент выигрывает по вечерней атмосфере и барной составляющей, уступает по кухне.', 'Коктейли; Шоу-атмосфера', 'Неровное качество блюд')
on conflict (id) do nothing;

insert into public.marketing (id, restaurant_id, site)
overriding system value
values
  (1, 1, 'https://ruski.com'),
  (2, 2, 'https://birds.moscow')
on conflict (id) do nothing;

insert into public.marketing_socials (id, marketing_id, network, url)
overriding system value
values
  (1, 1, 'telegram', 'https://t.me/ruski_rest'),
  (2, 1, 'instagram', 'https://instagram.com/ruski_rest'),
  (3, 2, 'instagram', 'https://instagram.com/birds.moscow')
on conflict (id) do nothing;

insert into public.marketing_loyalty (id, marketing_id, has_loyalty, loyalty_name, loyalty_format, loyalty_cost_per_point, loyalty_how_to_earn)
overriding system value
values
  (1, 1, true, 'Ruski Club', 'кэшбэк; спецпредложения', 1, 'Бонусы начисляются после регистрации и оплаты счета'),
  (2, 2, false, '', '', 0, '')
on conflict (id) do nothing;

insert into public.technical_analysis (id, restaurant_id, url, status_code, load_time_sec, mobile_load_time_sec, page_size_kb, title, meta_description, https, has_viewport, error)
overriding system value
values
  (1, 1, 'https://ruski.com', 200, 1.52, 2.41, 1040.2, 'Ruski Restaurant', 'Панорамный ресторан русской кухни в Москва-Сити.', true, true, ''),
  (2, 2, 'https://birds.moscow', 0, 0, 0, 0, '', '', false, false, 'ssl handshake error')
on conflict (id) do nothing;

insert into public.strategic_report (id, restaurant_id, block1, block2, block3, block4, block5, report_md, positioning, menu, reviews, marketing, technical_part, business_recommendations, reference_info)
overriding system value
values
  (1, 1, 'block1_output.json', 'block2_output.json', 'block3_output.json', 'block4_output.json', 'block5_output.json',
   '# Конкурентный отчет\n\n## Позиционирование\nRuski удерживает сильную видовую премиальную позицию.',
   'Ruski выигрывает за счет русской кухни и панорамы, Birds сильнее в вечернем сценарии.',
   'У Ruski меню более цельное и считывается как гастрономическое, у Birds акцент смещен в бар и event-составляющую.',
   'У reference-заведения сильнее кухня и вид, у конкурента выше доля упоминаний атмосферы и шоу.',
   'Оба игрока присутствуют в соцсетях, но у Ruski лучше упакована программа лояльности.',
   'У Ruski сайт стабильнее, у конкурента заметны технические проблемы доступа.',
   'Стоит усиливать скорость сервиса и яснее выносить фирменные блюда в коммуникацию.',
   'Раздел собран на основе выходов блоков 1-5.')
on conflict (id) do nothing;
