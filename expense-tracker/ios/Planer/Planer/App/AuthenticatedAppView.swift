import SwiftUI

@MainActor
struct AuthenticatedAppView: View {
    @Binding private var pendingDeepLink: URL?
    @State private var store: FinanceStore
    @State private var router = AppRouter()
    @State private var syncStore: FirebaseSyncStore

    init(user: AuthenticatedUser, pendingDeepLink: Binding<URL?>) {
        _pendingDeepLink = pendingDeepLink
        _store = State(initialValue: FinanceStore(storageNamespace: user.id))
        _syncStore = State(initialValue: FirebaseSyncStore(user: user))
    }

    var body: some View {
        RootTabView(pendingDeepLink: $pendingDeepLink)
            .environment(store)
            .environment(router)
            .environment(syncStore)
            .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
            .task {
                syncStore.start(store: store)
            }
            .task(id: liveActivitySnapshot) {
                await DailyFinanceLiveActivityManager.shared.refresh(with: liveActivitySnapshot)
            }
            .onDisappear {
                syncStore.stop()
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
