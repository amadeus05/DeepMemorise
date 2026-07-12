# Deep Memorise

Telegram-бот для запоминания иностранных слов (SRS).

## Стек

- Node.js + TypeScript
- grammY
- PostgreSQL (Aiven) + Drizzle ORM

## Быстрый старт

1. Скопируй `.env.example` → `.env` и заполни:
   - `TELEGRAM_BOT_TOKEN`
   - `DATABASE_URL` (строка из Aiven Postgres)
2. Установи зависимости: `npm install`
3. Запуск: `npm run dev`

## Команды бота

- `/start` — приветствие и статус
- `/add` — добавить слово (по шагам или `/add word | перевод | пример`)
- `/words` / `/list` — словарь с пагинацией, просмотр / правка / удаление
- `/train` — повторение
- `/settings` — методика (SM-2 / Эббингауз)
- `/stats` — статистика
- `/cancel` — отменить ввод
