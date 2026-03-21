import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

// Подключение к Postgres
const client = new Client({
  user: 'your_user',
  host: 'localhost',
  database: 'your_db',
  password: 'your_password',
  port: 5432,
});

async function main() {
  await client.connect();

  // Импорт block1 (restaurants)
  const block1Path = path.join(__dirname, '../../tmp/competitive/examples/block1_output.example.json');
  const block1Data = JSON.parse(fs.readFileSync(block1Path, 'utf-8'));

  for (const place of block1Data.selected_places) {
    await client.query(
      `INSERT INTO restaurants (name, address, type, cuisine, avg_check, description, link, cosine_score, site, delivery, working_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        place['название'],
        place['адрес'],
        place['тип_заведения'],
        place['кухня'],
        place['средний_чек'],
        place['описание'],
        place['ссылка'],
        place['cosine_score'],
        place['сайт'],
        place['доставка'],
        place['время_работы'],
      ]
    );
  }

  // Импорт block2 (menus/menu_items)
  const block2Path = path.join(__dirname, '../../tmp/competitive/examples/block2_output.example.json');
  const block2Data = JSON.parse(fs.readFileSync(block2Path, 'utf-8'));

  for (const [placeName, menuEntry] of Object.entries(block2Data.menu_by_place)) {
    // Найти restaurant_id по названию
    const res = await client.query('SELECT id FROM restaurants WHERE name = $1', [placeName]);
    if (res.rows.length === 0) continue;
    const restaurant_id = res.rows[0].id;

    // Вставить меню
    const menuResult = await client.query(
      `INSERT INTO menus (restaurant_id, status, menu_urls, items_count, has_kids_menu, categories)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        restaurant_id,
        menuEntry.status,
        menuEntry.menu_urls || [],
        menuEntry.items_count || 0,
        menuEntry.has_kids_menu || false,
        menuEntry.categories || [],
      ]
    );
    const menu_id = menuResult.rows[0].id;

    // Вставить блюда
    if (menuEntry.items && Array.isArray(menuEntry.items)) {
      for (const item of menuEntry.items) {
        await client.query(
          `INSERT INTO menu_items (menu_id, category, name, price)
           VALUES ($1,$2,$3,$4)`,
          [menu_id, item.category, item.name, item.price]
        );
      }
    }
  }

  // Импорт block3 (reviews)
  const block3Path = path.join(__dirname, '../../tmp/competitive/examples/block3_output.example.json');
  const block3Data = JSON.parse(fs.readFileSync(block3Path, 'utf-8'));
  for (const summary of block3Data.summaries) {
    const res = await client.query('SELECT id FROM restaurants WHERE name = $1', [summary['заведение']]);
    if (res.rows.length === 0) continue;
    const restaurant_id = res.rows[0].id;
    await client.query(
      `INSERT INTO reviews (restaurant_id, summary_mode, reviews_count, general_info, positive, negative)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        restaurant_id,
        block3Data.summary_mode,
        summary['количество_отзывов'],
        summary['общая_информация'],
        Array.isArray(summary['положительное']) ? summary['положительное'].join('; ') : summary['положительное'],
        Array.isArray(summary['отрицательное']) ? summary['отрицательное'].join('; ') : summary['отрицательное'],
      ]
    );
  }

  // Импорт block4 (marketing, socials, loyalty)
  const block4Path = path.join(__dirname, '../../tmp/competitive/examples/block4_output.example.json');
  const block4Data = JSON.parse(fs.readFileSync(block4Path, 'utf-8'));
  for (const [placeName, marketingEntry] of Object.entries(block4Data.marketing_by_place)) {
    const res = await client.query('SELECT id FROM restaurants WHERE name = $1', [placeName]);
    if (res.rows.length === 0) continue;
    const restaurant_id = res.rows[0].id;
    // Вставить marketing
    const marketingResult = await client.query(
      `INSERT INTO marketing (restaurant_id, site) VALUES ($1,$2) RETURNING id`,
      [restaurant_id, marketingEntry['сайт']]
    );
    const marketing_id = marketingResult.rows[0].id;
    // Вставить socials
    if (marketingEntry['соцсети'] && Array.isArray(marketingEntry['соцсети'])) {
      for (const social of marketingEntry['соцсети']) {
        await client.query(
          `INSERT INTO marketing_socials (marketing_id, network, url) VALUES ($1,$2,$3)`,
          [marketing_id, social.network, social.url]
        );
      }
    }
    // Вставить loyalty
    if (marketingEntry['программа_лояльности']) {
      await client.query(
        `INSERT INTO marketing_loyalty (marketing_id, has_loyalty, loyalty_name, loyalty_format, loyalty_cost_per_point, loyalty_how_to_earn)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          marketing_id,
          marketingEntry['программа_лояльности'].has_loyalty,
          marketingEntry['программа_лояльности'].loyalty_name,
          Array.isArray(marketingEntry['программа_лояльности'].loyalty_format)
            ? marketingEntry['программа_лояльности'].loyalty_format.join('; ')
            : marketingEntry['программа_лояльности'].loyalty_format,
          marketingEntry['программа_лояльности'].loyalty_cost_per_point,
          marketingEntry['программа_лояльности'].loyalty_how_to_earn,
        ]
      );
    }
  }

  // Импорт block5 (technical_analysis)
  const block5Path = path.join(__dirname, '../../tmp/competitive/examples/block5_output.example.json');
  const block5Data = JSON.parse(fs.readFileSync(block5Path, 'utf-8'));
  for (const [placeName, techEntry] of Object.entries(block5Data.tech_by_place)) {
    const res = await client.query('SELECT id FROM restaurants WHERE name = $1', [placeName]);
    if (res.rows.length === 0) continue;
    const restaurant_id = res.rows[0].id;
    await client.query(
      `INSERT INTO technical_analysis (restaurant_id, url, status_code, load_time_sec, mobile_load_time_sec, page_size_kb, title, meta_description, https, has_viewport, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        techEntry.url,
        techEntry.status_code || null,
        techEntry.load_time_sec || null,
        techEntry.mobile_load_time_sec || null,
        techEntry.page_size_kb || null,
        techEntry.title || null,
        techEntry.meta_description || null,
        techEntry.https || null,
        techEntry.has_viewport || null,
        techEntry.error || null,
        restaurant_id,
      ]
    );
  }

  // Импорт block6 (strategic_report)
  const block6Path = path.join(__dirname, '../../tmp/competitive/examples/block6_output.example.json');
  const block6Data = JSON.parse(fs.readFileSync(block6Path, 'utf-8'));
  // Для simplicity: вставим для reference_place
  const refPlace = block1Data.reference_place?.name || 'Ruski';
  const res = await client.query('SELECT id FROM restaurants WHERE name = $1', [refPlace]);
  if (res.rows.length > 0) {
    const restaurant_id = res.rows[0].id;
    await client.query(
      `INSERT INTO strategic_report (restaurant_id, block1, block2, block3, block4, block5, report_md, positioning, menu, reviews, marketing, technical_part, business_recommendations, reference_info)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        restaurant_id,
        block6Data.input_sources.block1,
        block6Data.input_sources.block2,
        block6Data.input_sources.block3,
        block6Data.input_sources.block4,
        block6Data.input_sources.block5,
        block6Data.report_md,
        block6Data.sections['позиционирование'],
        block6Data.sections['меню'],
        block6Data.sections['отзывы'],
        block6Data.sections['маркетинг'],
        block6Data.sections['техническая часть'],
        block6Data.sections['бизнес-рекомендации'],
        block6Data.sections['справочная информация'],
      ]
    );
  }

  await client.end();
  console.log('Импорт завершён');
}

main().catch(console.error);
