import SwiftUI

struct RootTabView: View {
    @Binding var pendingDeepLink: URL?
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(FirebaseSyncStore.self) private var syncStore

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
        .task(id: pendingDeepLink) {
            guard let url = pendingDeepLink else { return }
            await openDeepLink(url)
            pendingDeepLink = nil
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
        case .spaceSwitcher:
            NavigationStack { SpaceSwitcherView() }
        case .newGoal:
            NavigationStack { GoalEditorView() }
        case .newDebt:
            NavigationStack { DebtEditorView() }
        case .newCredit:
            NavigationStack { CreditEditorView() }
        case .credit(let credit):
            NavigationStack { CreditDetailView(creditID: credit.id) }
        case .fundGoal(let goal):
            NavigationStack { GoalFundingView(goal: goal) }
        case .settleDebt(let debt):
            NavigationStack { DebtSettlementView(debt: debt) }
        case .receipt(let receipt):
            NavigationStack { ReceiptDetailView(receipt: receipt) }
        case .familyAccounts:
            NavigationStack { FamilyAccountsView() }
        case .familyJoin(let code):
            NavigationStack { FamilyJoinView(codeOrLink: code) }
        }
    }

    private func openDeepLink(_ url: URL) async {
        if url.scheme == "planer", url.host == "family", url.pathComponents.count <= 1 {
            router.selectedTab = .home
            router.presentedSheet = .familyAccounts
            return
        }

        if let familyCode = FamilyInviteLink.code(from: url.absoluteString),
           url.scheme == "planer",
           url.host == "family" {
            router.selectedTab = .home
            router.presentedSheet = .familyJoin(code: familyCode)
            return
        }

        if url.scheme == "planer", url.host == "transaction",
           let rawKind = url.pathComponents.last,
           let kind = FinanceTransactionKind(rawValue: rawKind),
           kind != .transfer {
            router.selectedTab = .home
            router.presentedSheet = .newTransaction(kind)
            return
        }

        if url.scheme == "planer", url.host == "credit",
           let rawID = url.pathComponents.last,
           let id = UUID(uuidString: rawID),
           let credit = store.credits.first(where: { $0.id == id }) {
            router.selectedTab = .finance
            router.presentedSheet = .credit(credit)
            return
        }

        let code: String?
        if url.scheme == "planer", url.host == "receipt" {
            code = url.pathComponents.last.flatMap { $0 == "/" ? nil : $0 }
        } else if url.host == "planer-app-3a0f2.web.app" {
            code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "receipt" })?
                .value
        } else {
            code = nil
        }
        guard let code else { return }

        router.selectedTab = .receipts
        if let localReceipt = store.receipts.first(where: { $0.shareCode == code }) {
            router.presentedSheet = .receipt(localReceipt)
            return
        }
        if let sharedReceipt = try? await syncStore.fetchSharedReceipt(code: code) {
            router.presentedSheet = .receipt(sharedReceipt)
        }
    }
}

#Preview("Root — dark") {
    RootTabView(pendingDeepLink: .constant(nil))
        .environment(FinanceStore.previewStore())
        .environment(AppRouter())
        .environment(FirebaseSyncStore.preview())
        .environment(FamilyAccountStore.preview())
        .preferredColorScheme(.dark)
}
