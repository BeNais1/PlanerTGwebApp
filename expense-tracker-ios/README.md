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

When you click **Run workflow**, GitHub Actions builds the app without code signing, packages `Payload/ExpenseTrackerSwiftUI.app` into `ExpenseTrackerSwiftUI.ipa`, and uploads it as an artifact.

You can add signing later outside this workflow.
