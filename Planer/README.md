# Planer for iOS

Нативний SwiftUI-застосунок для особистих фінансів із Google Sign-In, Firebase Realtime Database та Liquid Glass на iOS 26+.

## Що реалізовано

- вхід лише через Google за допомогою Firebase Authentication;
- окремий хмарний простір для кожного Firebase UID;
- чистий перший запуск без демонстраційних гаманців та операцій;
- локальний кеш у `UserDefaults`, розділений за Google-акаунтами;
- синхронізація повного фінансового знімка в `users/{uid}/iosSnapshot`;
- сімейні простори зі спільними гаманцями та операціями в `families/{familyId}/iosSnapshot`;
- запрошення до сім’ї через посилання `planer://family/join/{code}`, QR-код або ручне введення коду;
- сканування QR-кодів камерою та окремий локальний кеш для кожного сімейного простору;
- світлий і темний варіанти App Icon;
- кольорові категорії витрат у редакторі, списках та аналітиці;
- вибір дати й точного часу кожної операції;
- створення чека безпосередньо з операції із захистом від дублікатів;
- загальний баланс лише для двох або більше гаманців;
- детальна аналітика за власний період, типом, гаманцем і категорією;
- розбивка аналітики за категоріями, гаманцями, часовою шкалою та окремими операціями;
- поповнення цілі з необов’язковим списанням із вибраного гаманця;
- закриття боргу з необов’язковим зарахуванням або списанням;
- видалення всіх локальних і хмарних фінансових даних із налаштувань;
- кредити з довільним графіком платежів, терміновими нагадуваннями та окремим вибором списання з картки;
- надійна офлайн-черга з operation ID і SHA-256 перевіркою після підтвердження Firebase;
- серверна черга сімейних подій для доставки операцій іншим учасникам;
- попередження про можливі неактуальні сімейні дані без мережі;
- знайомство із застосунком на першому запуску та після видалення даних;
- Liquid Glass на iOS 26+ і системний material fallback на iOS 17–25.

Застосунок не використовує Telegram-авторизацію або прив’язування Telegram-профілю.

## Firebase

- Project ID: `planer-app-3a0f2`
- Bundle ID: `planer`
- Конфигурация: `Planer/GoogleService-Info.plist`
- Провайдер: Google
- База: Firebase Realtime Database

У Firebase Console має бути ввімкнено провайдер **Authentication → Sign-in method → Google**. Для сімейних просторів потрібно також розгорнути актуальний `database.rules.json` із правилами `families`, `family_invites` і `user_families`.

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
3. відновлює кеш Swift packages і Xcode DerivedData;
4. компілює застосунок і запускає модульні тести;
5. збирає непідписаний device build;
6. завантажує `Planer-unsigned.ipa` і SHA-256 checksum.

Перед встановленням IPA його потрібно підписати сертифікатом і provisioning profile для Bundle ID `planer`.

### Встановлення через Sideloadly

Live Activity працює через вкладене розширення `PlugIns/PlanerLiveActivity.appex`, тому його не можна видаляти під час підпису:

1. відкрийте **Advanced Options**;
2. залиште **Use automatic bundle ID** увімкненим;
3. натисніть рядок керування Plug-ins і переконайтеся, що `PlanerLiveActivity.appex` зберігається — інтерфейс не має показувати `Dropping all (1) plug-ins`;
4. не вмикайте **Use custom entitlements** і не додавайте tweak injection;
5. встановіть IPA, відкрийте Planer та перейдіть у **Налаштування → Dynamic Island і екран блокування**;
6. перевірте, що показані Bundle ID застосунку й extension, а ID extension починається з повного ID застосунку та крапки;
7. натисніть **Запустити повторно**, згорніть застосунок і заблокуйте екран.

Безкоштовний Apple ID має підписати два App ID — основний застосунок і Live Activity extension — і потребує повторного встановлення щонайменше раз на сім днів.

## Формат даних

Нативний знімок зберігається у власному просторі Google-користувача:

```text
users/{firebaseUID}/profile
users/{firebaseUID}/iosSnapshot/schemaVersion
users/{firebaseUID}/iosSnapshot/snapshotJSON
users/{firebaseUID}/iosSnapshot/updatedAt
users/{firebaseUID}/iosSnapshot/operationID
users/{firebaseUID}/iosSnapshot/checksum
user_family_events/{firebaseUID}/{eventId}
user_families/{firebaseUID}/{familyId}
families/{familyId}/members/{firebaseUID}
families/{familyId}/iosSnapshot/snapshotJSON
family_invites/{inviteCode}
```

Версія 3 зберігає знімок як цілісний JSON-рядок, додає ідентифікатор операції та SHA-256 checksum. Локальна черга видаляє зміну тільки після відповіді Firebase і повторного читання збіжного checksum.
