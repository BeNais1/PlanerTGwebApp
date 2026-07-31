# Planer for iOS

Нативное SwiftUI-приложение для личных финансов с Google Sign-In, Firebase Realtime Database и Liquid Glass на iOS 26+.

## Что реализовано

- вход только через Google с помощью Firebase Authentication;
- отдельное облачное пространство для каждого Firebase UID;
- чистый первый запуск без демо-кошельков и операций;
- локальный кеш в `UserDefaults`, разделённый по Google-аккаунтам;
- синхронизация полного финансового snapshot в `users/{uid}/iosSnapshot`;
- удаление всех локальных и облачных финансовых данных из настроек;
- кошельки, расходы, доходы, переводы, лимит, цели, долги, чеки и аналитика;
- Liquid Glass на iOS 26+ и системный material fallback на iOS 17–25.

Telegram-авторизация и связывание с Telegram-профилем намеренно не используются.

## Firebase

- Project ID: `planer-app-3a0f2`
- Bundle ID: `planer`
- Конфигурация: `Planer/GoogleService-Info.plist`
- Провайдер: Google
- База: Firebase Realtime Database

В Firebase Console должен быть включён провайдер **Authentication → Sign-in method → Google**. Правила Realtime Database должны разрешать пользователю читать и записывать только `users/{auth.uid}`.

## Генерация и запуск проекта

Проект описан в `project.yml`. Перед открытием в Xcode выполните:

```bash
brew install xcodegen
xcodegen generate
open Planer.xcodeproj
```

Выберите схему `Planer` и запустите приложение на iPhone Simulator или устройстве. Для интерактивного Google Sign-In нужен доступ к интернету.

## Unsigned IPA через GitHub Actions

Workflow `Build unsigned iOS IPA` автоматически:

1. устанавливает XcodeGen;
2. генерирует Xcode-проект;
3. разрешает Firebase и GoogleSignIn Swift packages;
4. компилирует приложение и тесты;
5. собирает неподписанный device build;
6. загружает `Planer-unsigned.ipa` и SHA-256 checksum.

Перед установкой IPA необходимо подписать сертификатом и provisioning profile для Bundle ID `planer`.

## Формат данных

Нативный snapshot хранится отдельно от данных Telegram Mini App:

```text
users/{firebaseUID}/profile
users/{firebaseUID}/iosSnapshot/schemaVersion
users/{firebaseUID}/iosSnapshot/snapshot
users/{firebaseUID}/iosSnapshot/updatedAt
```

Это исключает случайное смешивание старых Telegram-данных с новым Google-аккаунтом.
