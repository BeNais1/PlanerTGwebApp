# Web → iOS migration audit

## Поточна веб-архітектура

Веб-застосунок — Telegram Mini App на React 19, TypeScript і Vite. Після перевірки Telegram `initData` Express backend повертає JWT та Firebase custom token. Особисті гаманці, операції, налаштування, підписки й більшість чеків читаються React-клієнтом безпосередньо з Firebase Realtime Database. Backend окремо обслуговує сімейні атомарні операції, Joint Checks, Vault, webhook і cron.

Основна карта UI:

1. Головна — перемикач простору, карусель гаманців, ліміт, останні операції, швидкі дії.
2. Фінанси — цілі, автокатегоризація, пошук, борги, збережені чеки.
3. Чеки — збережені та поширені receipt snapshots.
4. Аналітика — періоди, типи операцій, категорії, тренди й валюти.

## Що перенесено

| Область | iOS build |
| --- | --- |
| Навігація | Нативний `TabView`, окремий `NavigationStack` на вкладку |
| Гаманці | Карусель, мультивалютність, додавання, локальне збереження |
| Операції | Витрата, дохід, переказ, деталі, видалення з реверсом балансу |
| Ліміт | Місячний прогрес і редагування |
| Фінанси | Цілі, поповнення, борги, пошук операцій |
| Чеки | Нативний список і явний sync-status |
| Аналітика | Підсумки, 7-денний графік, категорії |
| Liquid Glass | Системна tab bar + custom glass controls на iOS 26, material fallback |
| Тести | Баланс витрат, реверс видалення, конвертація переказу, cap ліміту |

## Чому production-sync не ввімкнено автоматично

Telegram Mini App `initData` існує тільки всередині Telegram WebView. Нативний застосунок не може безпечно згенерувати його самостійно. Поточний backend не має CRUD API для особистих гаманців та операцій; ці записи веб-клієнт змінює напряму у Firebase. Копіювати публічний Firebase web config у iOS недостатньо — потрібен валідний Firebase Auth custom token і правила доступу.

## Рекомендований production-контракт

1. `POST /api/auth/apple` — перевірка Apple identity token, створення або пошук native account.
2. `POST /api/account-links/telegram` — одноразове підтвердження через Telegram deep link та зв’язування ідентичностей.
3. `GET/POST/PUT/DELETE /api/wallets` і `/api/transactions` — єдина авторизована поверхня для web та iOS, або видача Firebase custom token для обох клієнтів.
4. `GET/PUT /api/settings`, endpoints для goals, debts, receipts і subscriptions.
5. Ідемпотентні mutation IDs, server timestamps та version field для offline queue/conflict resolution.
6. Universal Links: `/receipt/:shareCode`, `/family/join/:inviteCode`.

## Liquid Glass decisions

Liquid Glass використовується як окремий функціональний шар: tab bar, перемикач простору, settings control і кластер швидких дій. Гаманці, бюджет, списки та аналітичні картки залишаються content surfaces. Це зберігає ієрархію, контраст і не перетворює весь екран на набір конкуруючих glass-форм.
