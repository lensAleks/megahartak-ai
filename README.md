# Megahartak AI Backend (Node.js)

Мини-backend для AI-ассистента Megahartak / BBay на Node.js.

## Быстрый старт

1. Распакуйте архив.
2. В корне проекта выполните:

```bash
npm install
```

3. Создайте файл `.env` в корне проекта:

```env
OPENAI_API_KEY=ВАШ_КЛЮЧ_OpenAI
ASSISTANT_ID=asst_xxxxxxxxxxxxxxxxx
PORT=3000
```

4. Запуск локально:

```bash
npm start
```

Сервер поднимется на `http://localhost:3000`.

Основной endpoint:

`POST /assistant` с JSON телом:

```json
{ "query": "Ваш вопрос пользователя" }
```

На проде (Render и т.п.) переменные из `.env` нужно добавить в разделе Environment.
`.env` в GitHub НЕ загружать.
