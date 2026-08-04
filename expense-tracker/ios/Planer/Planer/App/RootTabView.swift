import SwiftUI

struct RootTabView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.selectedTab) {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label("Головна", systemImage: "house.fill") }
            .tag(AppTab.home)

            NavigationStack {
                FinanceHubView()
            }
            .tabItem { Label("Фінанси", systemImage: "wallet.bifold.fill") }
            .tag(AppTab.finance)

            NavigationStack {
                ReceiptsView()
            }
            .tabItem { Label("Чеки", systemImage: "bookmark.fill") }
            .tag(AppTab.receipts)

            NavigationStack {
                PlanerAnalyticsView()
            }
            .tabItem { Label("Аналітика", systemImage: "chart.bar.fill") }
            .tag(AppTab.analytics)
        }
        .tint(PlanerTheme.accent)
        .sheet(item: $router.presentedSheet) { destination in
            sheetContent(for: destination)
        }
    }

    @ViewBuilder
    private func sheetContent(for destination: SheetDestination) -> some View {
        switch destination {
        case .newTransaction(let kind):
            NavigationStack { TransactionEditorView(kind: kind) }
        case .transaction(let transaction):
            NavigationStack { TransactionDetailView(transaction: transaction) }
        case .addWallet:
            NavigationStack { AddWalletView() }
        case .budget:
            NavigationStack { BudgetEditorView() }
        case .settings:
            NavigationStack { SettingsView() }
        case .newGoal:
            NavigationStack { GoalEditorView() }
        case .newDebt:
            NavigationStack { DebtEditorView() }
        case .fundGoal(let goal):
            NavigationStack { GoalFundingView(goal: goal) }
        case .settleDebt(let debt):
            NavigationStack { DebtSettlementView(debt: debt) }
        }
    }
}

#Preview("Root — dark") {
    RootTabView()
        .environment(FinanceStore.previewStore())
        .environment(AppRouter())
        .preferredColorScheme(.dark)
}
