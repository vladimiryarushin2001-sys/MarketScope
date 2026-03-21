#!/usr/bin/env node
/**
 * Читает data.json из tmp/competitive и tmp/market и отправляет в Supabase (Edge Function ingest).
 * Использование:
 *   cp -r tmp public/tmp   # если JSON лежит в корневом tmp
 *   node scripts/ingest-from-tmp.mjs
 * Переменные окружения: VITE_SUPABASE_URL (или SUPABASE_URL), VITE_SUPABASE_ANON_KEY (или SUPABASE_ANON_KEY)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (или SUPABASE_URL и SUPABASE_ANON_KEY)');
  process.exit(1);
}

const ingestUrl = `${url.replace(/\/$/, '')}/functions/v1/ingest`;

function loadJson(dir) {
  const path = join(root, dir, 'data.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.warn(`Не удалось прочитать ${path}:`, e.message);
    return null;
  }
}

async function postIngest(data) {
  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ingest: ${res.status} ${text}`);
  }
  return JSON.parse(text || '{}');
}

async function main() {
  const competitive = loadJson('public/tmp/competitive') || loadJson('tmp/competitive');
  const market = loadJson('public/tmp/market') || loadJson('tmp/market');

  if (competitive?.restaurants?.length) {
    const result = await postIngest(competitive);
    console.log('competitive:', result);
  }
  if (market?.restaurants?.length) {
    const result = await postIngest(market);
    console.log('market:', result);
  }
  if (!competitive?.restaurants?.length && !market?.restaurants?.length) {
    console.log('Нет data.json с непустым restaurants в public/tmp/competitive или tmp/competitive (и market).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
