# Planer for iOS

Нативний SwiftUI-застосунок для особистих фінансів із Google Sign-In, Firebase Realtime Database та Liquid Glass на iOS 26+.

## Що реалізовано

- вхід лише через Google за допомогою Firebase Authentication;
- окремий хмарний простір для кожного Firebase UID;
- чистий перший запуск без демонстраційних гаманців та операцій;
- локальний кеш у `UserDefaults`, розділений за Google-акаунтами;
- синхронізація повного фінансового знімка в `users/{uid}/iosSnapshot`;
- кольорові категорії витрат у редакторі, списках та аналітиці;
- поповнення цілі з необов’язковим списанням із вибраного гаманця;
- закриття боргу з необов’язковим зарахуванням або списанням;
- видалення всіх локальних і хмарних фінансових даних із налаштувань;
- Liquid Glass на iOS 26+ і системний material fallback на iOS 17–25.

Застосунок не використовує Telegram-авторизацію або прив’язування Telegram-профілю.

## Firebase

- Project ID: `planer-app-3a0f2`
- Bundle ID: `planer`
- Конфигурация: `Planer/GoogleService-Info.plist`
- Провайдер: Google
- База: Firebase Realtime Database

У Firebase Console має бути ввімкнено провайдер **Authentication → Sign-in method → Google**. Правила Realtime Database мають дозволяти користувачеві читати й записувати лише `users/{auth.uid}`.

## Генерація та запуск проєкту

Проєкт описано в `project.yml`. Перед відкриттям у Xcode виконайте:

```bash
brew install xcodegen
xcodegen generate
open Planer.xcodeproj
```

Виберіть схему `Planer` і запустіть застосунок на iPhone Simulator або пристрої. Для інтерактивного Google Sign-In потрібен доступ до інтернету.

## Unsigned IPA через GitHub Actions

Workflow `Build unsigned iOS IPA` автоматично:

1. встановлює XcodeGen;
2. генерує Xcode-проєкт;
3. завантажує Firebase і GoogleSignIn Swift packages;
4. компілює застосунок і запускає модульні тести;
5. збирає непідписаний device build;
6. завантажує `Planer-unsigned.ipa` і SHA-256 checksum.

Перед встановленням IPA його потрібно підписати сертифікатом і provisioning profile для Bundle ID `planer`.

## Формат даних

Нативний знімок зберігається у власному просторі Google-користувача:

```text
users/{firebaseUID}/profile
users/{firebaseUID}/iosSnapshot/schemaVersion
users/{firebaseUID}/iosSnapshot/snapshotJSON
users/{firebaseUID}/iosSnapshot/updatedAt
```

Версія 2 зберігає знімок як цілісний JSON-рядок, тому Firebase не видаляє порожні масиви й чистий акаунт коректно синхронізується.
