# Поднятие БД для MarketScope

Чтобы данные тянулись из Supabase, сделайте по шагам.

## 1. Проект Supabase

- Зайдите на [supabase.com](https://supabase.com) и войдите в аккаунт.
- Если проекта ещё нет: **New project** → выберите организацию, имя проекта, пароль БД, регион → **Create**.
- Дождитесь создания проекта.

## 2. Выполнить SQL в Supabase

- В проекте откройте **SQL Editor** (слева).
- Нажмите **New query**.
- Скопируйте и вставьте **весь** текст из файла `run_first.sql` (в этой же папке).
- Нажмите **Run** (или Cmd+Enter).
- Внизу должно появиться **Success. No rows returned** — это нормально (такие команды не возвращают строк).
- Проверка: откройте **Table Editor** → таблица **restaurants** — в ней должно быть 2 строки (Ruski, Birds).

Так создадутся таблицы и вставятся демо-данные (Ruski, Birds).

### Таблица профилей пользователей (для авторизации)

Чтобы работали регистрация и вход (Supabase Auth) и хранение профиля (имя, телефон, компания):

- В **SQL Editor** выполните ещё один запрос: скопируйте содержимое файла `migrations/20250315000000_create_profiles.sql` и нажмите **Run**.

Будет создана таблица `public.profiles` (связь с `auth.users`) и триггер: при каждой новой регистрации в ней автоматически создаётся строка с email и именем из формы.

### Обновление схемы под новый формат данных (v2 / `tmp 2`)

Если вы загружаете новые JSON (v2) из папки `tmp 2/` (block1..block6), примените миграцию:

- `migrations/20250317000000_alter_for_v2_json.sql`

Она добавит новые поля и приведёт типы лояльности/соцсетей к формату v2.

## 3. Переменные окружения

В корне проекта `MarketScope` должен быть файл `.env`:

```env
VITE_SUPABASE_URL=https://ВАШ_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_ключ
```

- **Project URL** и **anon public** ключ: в Supabase → **Settings** → **API** → Project URL и Project API keys → anon public.

Если `.env` уже заполнен (как у вас), этот шаг можно пропустить.

## 4. Запуск сайта

```bash
cd /Users/arushin_va/Desktop/mark/MarketScope
npm run dev
```

Откройте в браузере **http://localhost:5173**. Данные должны подгружаться из БД (те же два ресторана, что в демо).

## Дополнительно: загрузка своих JSON в БД

- Положите `data.json` в `public/tmp/competitive/` или `tmp/competitive/`.
- Задеплойте Edge Function: `supabase functions deploy ingest`.
- Выполните:  
  `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/ingest-from-tmp.mjs`

После этого в БД появятся данные из JSON, и сайт будет показывать их.
