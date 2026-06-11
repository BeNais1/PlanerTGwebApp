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
BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret
JWT_SECRET=your_jwt_secret_key_at_least_32_chars
ADMIN_TELEGRAM_ID=7801680802
PORT=3000
FIREBASE_PROJECT_ID=planer-app-3a0f2
DATABASE_URL=https://planer-app-3a0f2-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'
API_PUBLIC_URL=https://your-backend-url.vercel.app
APP_WEB_URL=https://planer-app-3a0f2.web.app
CORS_ORIGINS=http://localhost:5173,https://planer-app-3a0f2.web.app,https://planer-app-3a0f2.firebaseapp.com
VAULT_PRICE_STARS=250
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
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add JWT_SECRET
vercel env add ADMIN_TELEGRAM_ID
vercel env add FIREBASE_PROJECT_ID
vercel env add DATABASE_URL
vercel env add FIREBASE_SERVICE_ACCOUNT
vercel env add API_PUBLIC_URL
vercel env add APP_WEB_URL
vercel env add CORS_ORIGINS
vercel env add VAULT_PRICE_STARS
```

## Vault через Telegram Stars

Подписка Vault создается нативным инвойсом Telegram в валюте `XTR`.
`VAULT_PRICE_STARS=250` задает цену за период в 30 дней.

Бот обрабатывает `pre_checkout_query`, сохраняет оплату только после
`successful_payment` и предоставляет команды `/terms` и `/paysupport`.
Для тестирования администратором доступна отдельная demo-активация, которая
не создает invoice и не списывает Stars.

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
  "firebaseToken": "firebase_custom_token_here",
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
