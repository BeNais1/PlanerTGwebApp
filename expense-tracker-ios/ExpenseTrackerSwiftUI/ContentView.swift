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
                    .tabItem { Label("Home", systemImage: "house.fill") }
                    .tag(AppTab.home)

                    NavigationStack {
                        FinancialHubView()
                    }
                    .tabItem { Label("Finance", systemImage: "wallet.pass.fill") }
                    .tag(AppTab.finance)

                    NavigationStack {
                        ReceiptsView()
                    }
                    .tabItem { Label("Receipts", systemImage: "bookmark.fill") }
                    .tag(AppTab.receipts)

                    NavigationStack {
                        AnalyticsView()
                    }
                    .tabItem { Label("Analytics", systemImage: "chart.pie.fill") }
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
    case finance
    case receipts
    case analytics
}
