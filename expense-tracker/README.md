# Planer — Telegram Expense Tracker

Telegram Mini App для личных и совместных финансов. Клиент работает на React и Firebase Realtime Database, а Node.js backend проверяет Telegram `initData`, выпускает JWT/Firebase-токены, обслуживает Telegram-бота, напоминания, Vault-платежи и защищённые операции совместных чеков.

## Возможности

- несколько кошельков в EUR, USD и UAH;
- расходы, доходы, переводы и отмена последних операций;
- категории, быстрые продавцы и общий лимит расходов;
- аналитика по периодам, категориям, трендам и кошелькам;
- цели накоплений, долги и повторные списания;
- совместные чеки с QR-кодами и историей погашений;
- сохранение и отправка чеков;
- Telegram-напоминания о подписках;
- авторизация через Telegram Mini App;
- Vault-подписка через Telegram Stars.

## Архитектура

### Семейный бюджет

Личный и семейный бюджеты хранятся в разных пространствах. Пользователь переключает активное пространство в шапке приложения; кошельки, операции, лимиты, цели, долги, подписки и аналитика после переключения читаются из выбранного пространства.

- `owner` управляет участниками, ролями, кошельками и общими настройками;
- `admin` управляет участниками с ролью `member`, кошельками и настройками;
- `member` добавляет операции и изменяет только собственные операции;
- приглашение создаётся как код и Telegram deep link, действует 24 часа;
- семейные платежи, переводы, удаление и Undo выполняются backend-эндпоинтами атомарно вместе с балансами;
- cron рассылает напоминание о семейной подписке всем участникам, а первое подтверждение создаёт одну общую операцию.

```text
Telegram Mini App
        │
        ├── React 19 + TypeScript + Vite
        │     ├── src/pages/           основные экраны
        │     ├── src/components/      UI и модальные сценарии
        │     ├── src/domain/          чистая финансовая логика
        │     ├── src/hooks/           Firebase/Telegram hooks
        │     └── src/services/        API и Realtime Database
        │
        ├── Firebase
        │     ├── Authentication       custom token после Telegram auth
        │     ├── Realtime Database    кошельки, операции, чеки, настройки
        │     ├── database.rules.json  клиентские права доступа
        │     └── Hosting              production frontend
        │
        └── Express backend
              ├── Telegram initData/JWT
              ├── bot webhook и cron-напоминания
              ├── защищённые Joint Check payments
              └── Telegram Stars/Vault
```

Крупные экраны и модальные окна загружаются отдельными чанками через `React.lazy`. Изменение балансов, конвертация валют и расписание подписок вынесены в чистые функции и покрыты тестами.

## Требования

- Node.js 20 или новее;
- npm;
- Firebase project с Authentication, Realtime Database и Hosting;
- Telegram bot;
- Vercel project или другой Node.js-хостинг для backend.

## Локальный запуск

Установите зависимости frontend:

```bash
npm install
```

Установите зависимости backend:

```bash
cd backend
npm install
cd ..
```

Создайте frontend `.env` на основе `.env.example`:

```env
VITE_API_URL=http://localhost:3000
```

Создайте `backend/.env` на основе `backend/.env.example`. Затем запустите процессы в двух терминалах:

```bash
npm run dev
```

```bash
cd backend
npm run dev
```

Полная Telegram-авторизация работает только при запуске приложения как Mini App. Firebase web-конфигурация находится в `src/config/firebase.ts`; для другого Firebase project её необходимо заменить.

## Переменные backend

| Переменная | Назначение |
| --- | --- |
| `BOT_TOKEN` | токен Telegram-бота |
| `TELEGRAM_WEBHOOK_SECRET` | secret token Telegram webhook |
| `JWT_SECRET` | секрет JWT, минимум 32 символа |
| `ADMIN_TELEGRAM_ID` | Telegram ID администратора |
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account в одной строке |
| `DATABASE_URL` | URL Firebase Realtime Database |
| `API_PUBLIC_URL` | публичный URL backend |
| `APP_WEB_URL` | URL Firebase Hosting |
| `CORS_ORIGINS` | разрешённые origins через запятую |
| `CRON_SECRET` | секрет для `/api/cron` и admin endpoints |
| `VAULT_PRICE_STARS` | стоимость Vault в Telegram Stars |
| `PORT` | локальный порт, по умолчанию `3000` |

Не добавляйте `.env` и service-account JSON в Git.

## Проверки

```bash
npm run lint
npm test
npm run build
```

`npm test` проверяет:

- применение расходов и доходов к балансу;
- переводы между кошельками и конвертацию;
- удаление операции и восстановление через Undo;
- исторический баланс;
- валютные формулы;
- перенос дат и условия cron-напоминаний для подписок.

## Firebase Rules

Правила находятся в `database.rules.json`. Пользователь может изменять только собственные данные. Клиент может создать совместный чек, но не может самостоятельно менять его сумму, участников, платежи или остаток. Погашение выполняет авторизованный endpoint:

```text
POST /api/joint-checks/:jointCheckId/payments
Authorization: Bearer <JWT>
```

Firebase Admin SDK выполняет атомарное изменение совместного чека и обновляет связанные операции.

После изменения правил проверьте их в Firebase Emulator или Rules Playground и задеплойте:

```bash
npx firebase-tools deploy --only database
```

## Деплой

### Frontend и Database Rules

```bash
npm run lint
npm test
npm run deploy:hosting
npx firebase-tools deploy --only database
```

`deploy:hosting` запускает production-сборку перед публикацией. `version.json` обновляется во время сборки и используется клиентом для обнаружения новой версии.

### Backend

Из корня проекта:

```bash
vercel --prod
```

Корневой `vercel.json` направляет запросы в `backend/index.js`. После первого деплоя добавьте переменные окружения в Vercel и установите webhook:

```text
POST /api/set-webhook
x-admin-secret: <CRON_SECRET или TELEGRAM_WEBHOOK_SECRET>
```

Для напоминаний вызывайте `GET /api/cron` по расписанию с заголовком `x-cron-secret`.

## Основные API endpoints

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| `POST` | `/api/auth/telegram` | Telegram auth и выдача токенов |
| `GET` | `/api/auth/verify` | проверка JWT |
| `POST` | `/api/joint-checks/:id/payments` | защищённое погашение совместного чека |
| `POST` | `/api/vault/checkout` | создание Telegram Stars invoice |
| `GET` | `/api/cron` | отправка напоминаний |
| `GET` | `/health` | health check |

## Важные ограничения

- Курсы валют загружаются из API НБУ и кэшируются на один час; при ошибке используются fallback-курсы.
- JWT backend действует два часа.
- Прямые клиентские изменения платёжных полей Joint Check запрещены правилами.
- Перед production-деплоем необходимо проверить пользовательские сценарии внутри Telegram WebView на iOS и Android.
