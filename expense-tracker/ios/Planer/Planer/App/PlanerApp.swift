import SwiftUI

@main
@MainActor
struct PlanerApp: App {
    @State private var store = FinanceStore()
    @State private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(store)
                .environment(router)
                .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
        }
    }
}
