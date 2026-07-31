import SwiftUI

@MainActor
struct AuthenticatedAppView: View {
    @State private var store: FinanceStore
    @State private var router = AppRouter()
    @State private var syncStore: FirebaseSyncStore

    init(user: AuthenticatedUser) {
        _store = State(initialValue: FinanceStore(storageNamespace: user.id))
        _syncStore = State(initialValue: FirebaseSyncStore(user: user))
    }

    var body: some View {
        RootTabView()
            .environment(store)
            .environment(router)
            .environment(syncStore)
            .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
            .task {
                syncStore.start(store: store)
            }
            .onDisappear {
                syncStore.stop()
            }
    }
}
