# Expense Tracker Backend API

Backend API для Telegram Mini App - трекер расходов.

## Технологии

- Node.js + Express
- JWT авторизация
- Telegram Web App валидация
- Firebase Realtime Database

## Установка

```bash
npm install
```

## Переменные окружения

Создайте файл `.env`:

```
BOT_TOKEN=8385111399:AAEzQknMtLi3-daazEwCkvd0GbwgPcqXvjk
JWT_SECRET=your_jwt_secret_key
PORT=3000
FIREBASE_PROJECT_ID=planer-app-3a0f2
```

## Запуск локально

```bash
npm start
```

Или в режиме разработки:

```bash
npm run dev
```

## Деплой на Vercel

### Первый раз:

1. Установите Vercel CLI:
```bash
npm install -g vercel
```

2. Войдите в аккаунт:
```bash
vercel login
```

3. Задеплойте:
```bash
vercel --prod
```

4. Установите переменные окружения в Vercel:
```bash
vercel env add BOT_TOKEN
vercel env add JWT_SECRET
vercel env add FIREBASE_PROJECT_ID
```

### Последующие деплои:

```bash
vercel --prod
```

## API Endpoints

### Авторизация

**POST /api/auth/telegram**
```json
{
  "initData": "query_id=...&user=...&hash=..."
}
```

Ответ:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 123456,
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "photoUrl": "https://...",
    "languageCode": "en"
  }
}
```

**GET /api/auth/verify**

Headers:
```
Authorization: Bearer <token>
```

Ответ:
```json
{
  "success": true,
  "user": {
    "id": 123456,
    "username": "johndoe",
    "firstName": "John"
  }
}
```

### Health Check

**GET /health**

Ответ:
```json
{
  "status": "ok",
  "timestamp": "2026-04-06T13:00:00.000Z",
  "service": "expense-tracker-api"
}
```

## Структура проекта

```
backend/
├── index.js              # Главный файл сервера
├── routes/
│   └── auth.js          # Роуты авторизации
├── middleware/
│   └── verifyToken.js   # JWT middleware
├── utils/
│   └── telegram.js      # Telegram валидация
├── package.json
├── vercel.json          # Конфигурация Vercel
└── .env                 # Переменные окружения
```

## Безопасность

- Все запросы валидируются через Telegram hash
- JWT токены с истечением через 30 дней
- CORS настроен только для разрешенных доменов
- Переменные окружения не коммитятся в Git
