import SwiftUI

@MainActor
struct AuthenticatedAppView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Binding private var pendingDeepLink: URL?
    @State private var store: FinanceStore
    @State private var router = AppRouter()
    @State private var syncStore: FirebaseSyncStore
    @State private var familyStore: FamilyAccountStore
    @State private var liveActivityManager = DailyFinanceLiveActivityManager.shared

    init(user: AuthenticatedUser, pendingDeepLink: Binding<URL?>) {
        _pendingDeepLink = pendingDeepLink
        _store = State(initialValue: FinanceStore(storageNamespace: user.id))
        _syncStore = State(initialValue: FirebaseSyncStore(user: user))
        _familyStore = State(initialValue: FamilyAccountStore(user: user))
    }

    var body: some View {
        RootTabView(pendingDeepLink: $pendingDeepLink)
            .environment(store)
            .environment(router)
            .environment(syncStore)
            .environment(familyStore)
            .environment(liveActivityManager)
            .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
            .task {
                familyStore.start()
                syncStore.start(store: store, space: familyStore.activeSpace)
            }
            .onChange(of: familyStore.activeSpace) { _, space in
                syncStore.switchSpace(to: space, store: store)
            }
            .task(id: liveActivitySnapshot) {
                guard scenePhase == .active else { return }
                await liveActivityManager.refresh(with: liveActivitySnapshot)
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
            }
    }

    private var liveActivitySnapshot: DailyFinanceSnapshot {
        DailyFinanceSnapshot(
            expenses: store.todayExpenses,
            income: store.todayIncome,
            currencySymbol: store.mainCurrency.symbol
        )
    }
}
