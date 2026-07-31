# Planer for iOS

Нативний SwiftUI-прототип фінансового застосунку, перенесений із Telegram Mini App.

## Що реалізовано

- чотири вкладки веб-версії: Головна, Фінанси, Чеки, Аналітика;
- гаманці в UAH, USD та EUR;
- витрати, доходи, перекази й коректне оновлення балансів;
- місячний ліміт, фінансові цілі та борги;
- локальне збереження стану через `UserDefaults`;
- Liquid Glass для навігаційних та інтерактивних елементів на iOS 26+;
- fallback на системні матеріали для iOS 17–25;
- SwiftUI previews і unit-тести фінансової логіки.

## Запуск

1. Відкрийте `Planer.xcodeproj` у Xcode 26 або новішому.
2. Оберіть схему `Planer` та iPhone Simulator.
3. Запустіть `Product > Run`.

Якщо потрібно перевідтворити проєкт, встановіть XcodeGen і виконайте з цієї папки:

```bash
xcodegen generate
```

## Unsigned IPA через GitHub Actions

Workflow `Build unsigned iOS IPA` запускається автоматично для змін у `ios/` і вручну через вкладку **Actions → Build unsigned iOS IPA → Run workflow**.

Після успішного run відкрийте його сторінку та завантажте artifact `Planer-unsigned-ipa-<номер>`. Усередині будуть:

- `Planer-unsigned.ipa` — device build без code signing;
- `Planer-unsigned.ipa.sha256` — контрольна сума.

Unsigned IPA не встановлюється на iPhone напряму. Перед установленням його потрібно підписати вашим Apple Developer certificate та provisioning profile, зберігши bundle ID `com.boris.planer` або замінивши його на власний до збірки.

## Синхронізація з веб-версією

Поточний build працює local-first і не надсилає демо-дані назовні. Веб-клієнт отримує Firebase custom token через Telegram Mini App `initData`; нативний iOS-застосунок не має цього контексту. Для спільних production-даних потрібні:

1. нативний спосіб входу (рекомендовано Sign in with Apple);
2. endpoint зв’язування Apple-акаунта з існуючим Telegram user ID;
3. backend API для особистих гаманців, операцій, налаштувань і чеків або Firebase custom token після нативної авторизації;
4. Universal Links для shared receipts та family invites.

Детальний аудит є у `MIGRATION_AUDIT.md`.
