import SwiftUI

@MainActor
struct AuthenticatedAppView: View {
    @Environment(\.scenePhase) private var scenePhase
    private let user: AuthenticatedUser
    @Binding private var pendingDeepLink: URL?
    @State private var store: FinanceStore
    @State private var router = AppRouter()
    @State private var syncStore: FirebaseSyncStore
    @State private var familyStore: FamilyAccountStore
    @State private var liveActivityManager = DailyFinanceLiveActivityManager.shared
    @State private var notificationService = PlanerNotificationService.shared
    @State private var onboardingStore: AppOnboardingStore

    init(user: AuthenticatedUser, pendingDeepLink: Binding<URL?>) {
        self.user = user
        _pendingDeepLink = pendingDeepLink
        _store = State(initialValue: FinanceStore(storageNamespace: user.id))
        _syncStore = State(initialValue: FirebaseSyncStore(user: user))
        _familyStore = State(initialValue: FamilyAccountStore(user: user))
        _onboardingStore = State(initialValue: AppOnboardingStore(userID: user.id))
    }

    var body: some View {
        RootTabView(pendingDeepLink: $pendingDeepLink)
            .environment(store)
            .environment(router)
            .environment(syncStore)
            .environment(familyStore)
            .environment(liveActivityManager)
            .environment(notificationService)
            .environment(onboardingStore)
            .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
            .task {
                familyStore.start()
                store.setAllowsEditing(familyStore.canEditActiveSpace)
                store.setTransactionAuthorName(familyStore.activeFamily == nil ? nil : user.displayName)
                syncStore.start(store: store, space: familyStore.activeSpace)
                await notificationService.refreshAuthorizationStatus()
                notificationService.startFamilyEventListener(userID: user.id)
            }
            .onChange(of: familyStore.activeSpace) { _, space in
                store.setAllowsEditing(familyStore.canEditActiveSpace)
                store.setTransactionAuthorName(space.familyID == nil ? nil : user.displayName)
                syncStore.switchSpace(to: space, store: store)
            }
            .onChange(of: familyStore.canEditActiveSpace) { _, canEdit in
                store.setAllowsEditing(canEdit)
            }
            .task(id: liveActivitySnapshot) {
                guard scenePhase == .active else { return }
                await liveActivityManager.refresh(with: liveActivitySnapshot)
            }
            .task(id: notificationEvaluationKey) {
                await notificationService.rescheduleAll(
                    store: store,
                    familyName: familyStore.activeFamily?.name
                )
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active else { return }
                Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    await liveActivityManager.refresh(with: liveActivitySnapshot)
                }
            }
            .onDisappear {
                syncStore.stop()
                familyStore.stop()
                notificationService.stopFamilyEventListener()
            }
            .fullScreenCover(isPresented: Binding(
                get: { onboardingStore.shouldPresent },
                set: { if !$0 { onboardingStore.complete() } }
            )) {
                WelcomeOnboardingView()
                    .environment(onboardingStore)
                    .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
            }
    }

    private var liveActivitySnapshot: DailyFinanceSnapshot {
        DailyFinanceSnapshot(
            expenses: store.todayExpenses,
            income: store.todayIncome,
            currencySymbol: store.mainCurrency.symbol
        )
    }

    private var notificationEvaluationKey: NotificationEvaluationKey {
        NotificationEvaluationKey(
            transactions: store.transactions.hashValue,
            wallets: store.wallets.hashValue,
            goals: store.goals.hashValue,
            debts: store.debts.hashValue,
            credits: store.credits.hashValue,
            receipts: store.receipts.hashValue,
            budgetLimit: store.budgetLimit,
            familyID: familyStore.activeSpace.familyID,
            preferences: notificationService.preferences
        )
    }
}

private struct NotificationEvaluationKey: Hashable {
    let transactions: Int
    let wallets: Int
    let goals: Int
    let debts: Int
    let credits: Int
    let receipts: Int
    let budgetLimit: Double
    let familyID: String?
    let preferences: PlanerNotificationPreferences
}
