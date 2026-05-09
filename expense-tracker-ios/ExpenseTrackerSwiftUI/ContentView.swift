import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthViewModel
    @State private var selectedTab = AppTab.home
    @State private var showingAddSheet = false

    var body: some View {
        Group {
            if auth.user == nil {
                SignInView()
            } else {
                TabView(selection: $selectedTab) {
                    NavigationStack {
                        DashboardView(showingAddSheet: $showingAddSheet)
                    }
                    .tabItem { Label("Главная", systemImage: "house.fill") }
                    .tag(AppTab.home)

                    NavigationStack {
                        HistoryView()
                    }
                    .tabItem { Label("История", systemImage: "clock.fill") }
                    .tag(AppTab.history)

                    NavigationStack {
                        ReceiptsView()
                    }
                    .tabItem { Label("Чеки", systemImage: "bookmark.fill") }
                    .tag(AppTab.receipts)

                    NavigationStack {
                        AnalyticsView()
                    }
                    .tabItem { Label("Аналитика", systemImage: "chart.pie.fill") }
                    .tag(AppTab.analytics)
                }
                .tint(.mint)
                .sheet(isPresented: $showingAddSheet) {
                    AddTransactionSheet()
                        .environmentObject(store)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
        }
    }
}

private enum AppTab: Hashable {
    case home
    case history
    case receipts
    case analytics
}
