#!/usr/bin/env node
/**
 * Читает v2-блоки (block1..block6) из tmp 2/competitive или tmp 2/market
 * и отправляет их в Supabase (Edge Function ingest) как { blocks: { block1, ... } }.
 *
 * Путь можно задать через TMP2_DIR, например:
 *   TMP2_DIR="/Users/arushin_va/Desktop/mark/tmp 2/competitive" node scripts/ingest-from-tmp2.mjs
 *
 * По умолчанию пытается найти:
 * - ../tmp 2/competitive/examples (если нет output json)
 * - ../tmp 2/market/examples
 *
 * Переменные окружения:
 * - VITE_SUPABASE_URL (или SUPABASE_URL)
 * - VITE_SUPABASE_ANON_KEY (или SUPABASE_ANON_KEY)
 * - USER_ID (uuid пользователя из Supabase Auth) — чтобы ingest создал request/run и данные были видны по RLS
 * - QUERY_TEXT (необязательно) — текст запроса клиента для истории
 * - REQUEST_ID (необязательно) — если указать id уже созданного client_requests,
 *   ingest создаст новый analysis_run именно для этого запроса
 * - REQUEST_INPUT_FILE (необязательно) — путь к input_request.json (если не задан, ищется
 *   в `${TMP2_DIR}/examples/input_request.json` или в `tmp 2/(competitive|market)/examples/input_request.json`)
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

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.warn(`Не удалось прочитать ${path}:`, e.message);
    return null;
  }
}

function loadBlocksFromDir(dir) {
  const candidates = [
    // реальный output (если вы сохраняете так)
    ['block1', 'block1_output.json'],
    ['block2', 'block2_output.json'],
    ['block3', 'block3_output.json'],
    ['block4', 'block4_output.json'],
    ['block5', 'block5_output.json'],
    ['block6', 'block6_output.json'],
    ['block3_reviews_enriched', 'block3_reviews_enriched.json'],
  ];

  const blocks = {};
  for (const [key, filename] of candidates) {
    const p = join(dir, filename);
    const v = readJsonIfExists(p);
    if (v) blocks[key] = v;
  }
  return Object.keys(blocks).length ? blocks : null;
}

function loadBlocksFromExamples(dir) {
  const examples = join(dir, 'examples');
  const candidates = [
    // output в папке examples
    ['block1', 'block1_output.json'],
    ['block2', 'block2_output.json'],
    ['block3', 'block3_output.json'],
    ['block4', 'block4_output.json'],
    ['block5', 'block5_output.json'],
    ['block6', 'block6_output.json'],
    ['block3_reviews_enriched', 'block3_reviews_enriched.json'],
    // legacy/examples формат
    ['block1', 'block1_output.example.json'],
    ['block2', 'block2_output.example.json'],
    ['block3', 'block3_output.example.json'],
    ['block4', 'block4_output.example.json'],
    ['block5', 'block5_output.example.json'],
    ['block6', 'block6_output.example.json'],
  ];
  const blocks = {};
  for (const [key, filename] of candidates) {
    if (blocks[key]) continue;
    const p = join(examples, filename);
    const v = readJsonIfExists(p);
    if (v) blocks[key] = v;
  }
  return Object.keys(blocks).length ? blocks : null;
}

async function postIngest(payload) {
  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ingest: ${res.status} ${text}`);
  return JSON.parse(text || '{}');
}

async function main() {
  const explicit = process.env.TMP2_DIR;
  const dirs = explicit
    ? [explicit]
    : [join(root, 'tmp 2', 'competitive'), join(root, 'tmp 2', 'market')];

  const userId = process.env.USER_ID;
  const queryTextEnv = process.env.QUERY_TEXT || '';
  const requestIdEnv = process.env.REQUEST_ID;
  const requestId = requestIdEnv ? Number(requestIdEnv) : null;
  const requestInputFile = process.env.REQUEST_INPUT_FILE || null;

  let posted = 0;
  for (const dir of dirs) {
    const blocks = loadBlocksFromDir(dir) || loadBlocksFromExamples(dir);
    if (!blocks) continue;

    const inputPath = requestInputFile ?? join(dir, 'examples', 'input_request.json');
    const inputRequest = requestInputFile ? readJsonIfExists(inputPath) : readJsonIfExists(inputPath);

    const inferredFromInput =
      (inputRequest && typeof inputRequest === 'object' && (inputRequest.query_text ?? inputRequest.queryText)) || '';

    const inferredFromBlocks =
      blocks?.block1 && typeof blocks.block1 === 'object' ? (blocks.block1.report_type === 'competitive' ? 'Конкурентный анализ' : 'Обзор рынка') : '';

    const derivedQueryText = queryTextEnv || inferredFromInput || inferredFromBlocks || '';

    const params =
      inputRequest && typeof inputRequest === 'object'
        ? inputRequest.params && typeof inputRequest.params === 'object'
          ? inputRequest.params
          : inputRequest
        : undefined;

    const baseRequest = { query_text: derivedQueryText, ...(params ? { params } : {}) };
    const request = requestId ? { ...baseRequest, request_id: requestId } : baseRequest;
    const payload = userId
      ? { blocks, user_id: userId, request }
      : { blocks, request };
    const result = await postIngest(payload);
    console.log(`${dir}:`, result);
    posted++;
  }
  if (!posted) {
    console.log('Не нашёл v2-блоки. Укажите TMP2_DIR или положите block*_output.json (или examples) в tmp 2/(competitive|market).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

