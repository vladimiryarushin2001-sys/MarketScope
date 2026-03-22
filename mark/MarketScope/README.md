# MarketScope — анализ конкурентов HoReCa

Все данные идут через БД (PostgreSQL/Supabase): JSON из `tmp` загружается в БД, фронт читает только из БД. Если БД недоступна или пуста, показываются демо-данные.

## Схема: JSON → БД → фронт

1. **JSON попадает в папку `tmp`** (например `tmp/competitive/data.json`, `tmp/market/data.json`).
2. **Загрузка в БД** — скрипт или Edge Function отправляет содержимое JSON в Supabase; данные сохраняются в таблицы.
3. **Фронт** при открытии и по кнопке «Обновить» запрашивает данные из Supabase и отображает их.

## Настройка

### 1. Supabase

- Создайте проект в [Supabase](https://supabase.com).
- В **SQL Editor** выполните миграцию:  
  `supabase/migrations/20250314000000_create_dashboard_tables.sql`  
  (создаёт таблицы: `restaurants`, `menus`, `menu_items`, `reviews`, `marketing`, `marketing_socials`, `marketing_loyalty`, `technical_analysis`, `strategic_report`).
- В **Settings → API** возьмите **Project URL** и **anon public** key.
- В корне проекта создайте `.env`:
  ```env
  VITE_SUPABASE_URL=https://ВАШ_PROJECT.supabase.co
  VITE_SUPABASE_ANON_KEY=ваш_anon_key
  ```

### 2. Edge Function ingest (запись JSON в БД)

- Задеплойте функцию:  
  `supabase functions deploy ingest`  
  (для записи в таблицы лучше задать `SUPABASE_SERVICE_ROLE_KEY` в Secrets у функции).
- Функция принимает **POST** с телом в формате одного датасета (как один `data.json`):

```json
{
  "restaurants": [ { "name": "...", "address": "...", ... } ],
  "menus": [],
  "menuItems": [],
  "reviews": [],
  "marketing": [],
  "marketingSocials": [],
  "marketingLoyalty": [],
  "technicalAnalysis": [],
  "strategicReport": []
}
```

Поле `id` в теле можно не передавать — БД проставит его сама. Связи по `restaurant_id`, `menu_id`, `marketing_id` пересчитаются при вставке.

### 3. Загрузка данных из tmp в БД

Из корня **MarketScope**:

```bash
# JSON кладите в public/tmp/competitive/data.json и/или public/tmp/market/data.json
# (или в tmp/competitive и tmp/market, скрипт проверит оба варианта)

export VITE_SUPABASE_URL=https://ВАШ_PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=ваш_anon_key
node scripts/ingest-from-tmp.mjs
```

Скрипт прочитает `data.json` из указанных папок и отправит их в Edge Function `ingest` (каждый источник — отдельным запросом).

### 3.1. Загрузка данных v2 из `tmp 2/` (block1..block6)

Если у вас новый формат (как в папке `tmp 2/`): `block1_output.json` … `block6_output.json`, то:

- Примените миграцию `supabase/migrations/20250317000000_alter_for_v2_json.sql`
- Запустите скрипт:

```bash
export VITE_SUPABASE_URL=https://ВАШ_PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=ваш_anon_key
node scripts/ingest-from-tmp2.mjs
```

Edge Function `ingest` принимает payload вида `{ "blocks": { "block1": {...}, ... } }` и преобразует его в таблицы дашборда.

### 4. Фронт

- `npm run dev` — приложение подхватит `VITE_SUPABASE_*` из `.env`.
- Данные запрашиваются из Supabase (хук `useDashboardData`). Если БД недоступна или запрос падает, отображаются мок-данные.

### 5. Деплой на Vercel

1. [Vercel](https://vercel.com) → **Add New → Project** → подключи GitHub-репозиторий.
2. **Root Directory**: либо оставь **корень репо** (в нём **`vercel.json`** — сборка `mark/MarketScope`, иначе Vercel уйдёт в Python из-за `pyproject.toml`), либо укажи **`mark/MarketScope`** — тогда используется локальный `vercel.json` этой папки.
3. Команды сборки: `npm ci` и `npm run build` внутри `mark/MarketScope`, выход — **`dist`**.
4. **Settings → Environment Variables** (Production и при желании Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`  
   Шаблон: **`.env.example`** в этой папке. Без них сайт откроется, но авторизация и данные из Supabase работать не будут.
5. После деплоя скопируй URL вида `https://….vercel.app` в Supabase: **Authentication → URL Configuration**:
   - **Site URL** — продакшен URL;
   - **Redirect URLs** — тот же URL (и локальный `http://localhost:5173` для разработки).

CLI (альтернатива): из каталога `mark/MarketScope` после `npm i -g vercel` — `vercel` / `vercel --prod` (переменные окружения задаются в дашборде или через `vercel env`).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
