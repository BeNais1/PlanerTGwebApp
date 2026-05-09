# Expense Tracker SwiftUI

Native iOS 26 SwiftUI version of the expense tracker app.

## What is inside

- Pure SwiftUI app, no React Native, Expo, WebView, or Firebase wrapper.
- iOS deployment target: 26.0.
- Liquid Glass styling through `glassEffect(_:in:)` with material fallback for older previews.
- Local persistence with `UserDefaults` and Codable models.
- Screens for dashboard, transaction history, saved receipts, analytics, and settings.

## Open locally

Open `ExpenseTrackerSwiftUI.xcodeproj` in Xcode, select the `ExpenseTrackerSwiftUI` scheme, and run on an iOS 26 simulator or device.

## GitHub Actions IPA build

The workflow is manual only: `.github/workflows/ios-build.yml` uses `workflow_dispatch`, so creating these files will not start a build.

When you click **Run workflow**, the default `ipa_type` is `unsigned`. This builds an IPA artifact without Apple signing secrets, which is useful for checking that the app compiles in GitHub Actions.

For a device-installable signed IPA, choose `ipa_type: signed` and add these repository secrets first:

- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`
- `KEYCHAIN_PASSWORD`

The provisioning profile must match bundle ID `com.boris.expensetracker.swiftui`.
