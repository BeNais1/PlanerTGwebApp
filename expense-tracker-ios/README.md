# Expense Tracker SwiftUI

Native iOS 26 SwiftUI version of the expense tracker app.

## What is inside

- Pure SwiftUI app, no React Native, Expo, WebView, or Firebase wrapper.
- iOS deployment target: 26.0.
- Liquid Glass styling through `glassEffect(_:in:)` with material fallback for older previews.
- Firebase Auth with Google Sign-In.
- Realtime Database sync (`users/{uid}/swiftui_state`) plus local `UserDefaults` cache.
- Screens for dashboard, transaction history, saved receipts, analytics, and settings.

## Firebase and Google setup

1. In Firebase Console, enable **Authentication -> Google** provider.
2. Create an **iOS app** in the same Firebase project for your bundle id.
3. Open target build settings and set:
   - `GOOGLE_CLIENT_ID` (from Firebase iOS app config)
   - `REVERSED_CLIENT_ID` (the reversed value for URL callback)
4. Verify bundle identifier is `planer` (or update it in the project and Firebase app settings).
5. Optional: instead of manual keys, you can add `GoogleService-Info.plist` to the app target and the app will auto-configure Firebase from it.

## Open locally

Open `ExpenseTrackerSwiftUI.xcodeproj` in Xcode, select the `ExpenseTrackerSwiftUI` scheme, and run on an iOS 26 simulator or device.

## GitHub Actions IPA build

The workflow is manual only: `.github/workflows/ios-build.yml` uses `workflow_dispatch`, so creating these files will not start a build.

When you click **Run workflow**, GitHub Actions builds the app without code signing, packages `Payload/ExpenseTrackerSwiftUI.app` into `ExpenseTrackerSwiftUI.ipa`, and uploads it as an artifact.
Each workflow run also sets a higher `CURRENT_PROJECT_VERSION` from `GITHUB_RUN_NUMBER`, so the IPA is treated as an update build.

You can add signing later outside this workflow.
