import Foundation
import Observation

enum AppTab: Hashable {
    case home
    case finance
    case receipts
    case analytics
}

enum SheetDestination: Identifiable, Hashable {
    case newTransaction(FinanceTransactionKind)
    case transaction(FinanceTransaction)
    case addWallet
    case budget
    case settings
    case newGoal
    case newDebt
    case fundGoal(SavingsGoal)
    case settleDebt(DebtItem)
    case receipt(ReceiptSummary)

    var id: String {
        switch self {
        case .newTransaction(let kind): "new-transaction-\(kind.rawValue)"
        case .transaction(let transaction): "transaction-\(transaction.id)"
        case .addWallet: "add-wallet"
        case .budget: "budget"
        case .settings: "settings"
        case .newGoal: "new-goal"
        case .newDebt: "new-debt"
        case .fundGoal(let goal): "fund-goal-\(goal.id)"
        case .settleDebt(let debt): "settle-debt-\(debt.id)"
        case .receipt(let receipt): "receipt-\(receipt.id)"
        }
    }
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .home
    var presentedSheet: SheetDestination?
}
