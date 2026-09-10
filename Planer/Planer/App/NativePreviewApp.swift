#if DEBUG
import SwiftUI

/// Isolated fixtures for CI screenshots. Never compiled into the IPA.
struct NativePreviewApp: View {
    @State private var store = FinanceStore.previewStore()
    @State private var router = AppRouter()
    @State private var family = FamilyAccountStore.preview()
    @State private var auth = AuthSession.preview()
    @State private var link: URL?
    private let user = AuthenticatedUser(id: "preview-user", displayName: "Борис", email: "preview@example.com", photoURL: nil)
    var body: some View {
        RootTabView(pendingDeepLink: $link)
            .environment(store).environment(router).environment(family).environment(auth)
            .environment(FirebaseSyncStore(user: user))
            .environment(DailyFinanceLiveActivityManager.shared)
            .environment(PlanerNotificationService.shared)
            .environment(AppOnboardingStore(userID: "preview-user"))
            .preferredColorScheme(ProcessInfo.processInfo.arguments.contains("--dark") ? .dark : .light)
            .task {
                store.prefersDarkAppearance = ProcessInfo.processInfo.arguments.contains("--dark")
                if let wallet = store.wallets.first {
                    store.setPayday(PaydaySettings(date: .now.addingTimeInterval(864000), reserve: 5000, walletIDs: [wallet.id]))
                }
                if let first = store.transactions.first { store.updateTags(transactionID: first.id, text: "продукти, дім") }
                let args = ProcessInfo.processInfo.arguments
                if args.contains("--expense") { router.presentedSheet = .newTransaction(.expense) }
                if args.contains("--finance") { router.selectedTab = .finance }
                if args.contains("--analytics") { router.selectedTab = .analytics }
                if args.contains("--settings") { router.presentedSheet = .settings }
            }
    }
}
#endif
