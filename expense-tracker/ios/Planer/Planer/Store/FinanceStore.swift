import Foundation
import Observation

@MainActor
@Observable
final class FinanceStore {
    private static let storageKeyPrefix = "planer.ios.snapshot.v2"
    @ObservationIgnored private let storageKey: String
    private let persistsChanges: Bool
    @ObservationIgnored private var changeHandler: ((PlanerSnapshot) -> Void)?

    var wallets: [Wallet]
    var transactions: [FinanceTransaction]
    var goals: [SavingsGoal]
    var debts: [DebtItem]
    var receipts: [ReceiptSummary]
    var customCategories: [CustomTransactionCategory]
    var budgetLimit: Double
    var mainCurrency: Currency
    var prefersDarkAppearance: Bool
    var activeSpaceName: String

    init(
        snapshot: PlanerSnapshot? = nil,
        storageNamespace: String = "local",
        loadPersisted: Bool = true,
        persistsChanges: Bool = true
    ) {
        storageKey = "\(Self.storageKeyPrefix).\(storageNamespace)"
        self.persistsChanges = persistsChanges

        let restored: PlanerSnapshot?
        if let snapshot {
            restored = snapshot
        } else if loadPersisted,
                  let data = UserDefaults.standard.data(forKey: storageKey),
                  let decoded = try? JSONDecoder().decode(PlanerSnapshot.self, from: data) {
            restored = decoded
        } else {
            restored = nil
        }

        let initial = restored ?? .empty
        wallets = initial.wallets
        transactions = initial.transactions
        goals = initial.goals
        debts = initial.debts
        receipts = initial.receipts
        customCategories = initial.customCategories
        budgetLimit = initial.budgetLimit
        mainCurrency = initial.mainCurrency
        prefersDarkAppearance = initial.prefersDarkAppearance
        activeSpaceName = initial.activeSpaceName
    }

    var totalBalanceInMainCurrency: Double {
        wallets.reduce(0) { result, wallet in
            result + converted(wallet.balance, from: wallet.currency, to: mainCurrency)
        }
    }

    var currentMonthTransactions: [FinanceTransaction] {
        let calendar = Calendar.current
        return transactions.filter { calendar.isDate($0.date, equalTo: .now, toGranularity: .month) }
    }

    var monthlyExpenses: Double {
        currentMonthTransactions
            .filter { $0.kind == .expense }
            .reduce(0) { $0 + converted($1.amount, from: $1.currency, to: mainCurrency) }
    }

    var monthlyIncome: Double {
        currentMonthTransactions
            .filter { $0.kind == .income }
            .reduce(0) { $0 + converted($1.amount, from: $1.currency, to: mainCurrency) }
    }

    var todayExpenses: Double {
        transactions
            .filter { $0.kind == .expense && Calendar.current.isDateInToday($0.date) }
            .reduce(0) { $0 + converted($1.amount, from: $1.currency, to: mainCurrency) }
    }

    var todayIncome: Double {
        transactions
            .filter { $0.kind == .income && Calendar.current.isDateInToday($0.date) }
            .reduce(0) { $0 + converted($1.amount, from: $1.currency, to: mainCurrency) }
    }

    var budgetProgress: Double {
        guard budgetLimit > 0 else { return 0 }
        return min(monthlyExpenses / budgetLimit, 1)
    }

    var recentTransactions: [FinanceTransaction] {
        transactions.sorted { $0.date > $1.date }
    }

    func wallet(id: UUID) -> Wallet? {
        wallets.first { $0.id == id }
    }

    func receipt(for transactionID: UUID) -> ReceiptSummary? {
        receipts.first { $0.transactionID == transactionID }
    }

    func savedReceipt(matching receipt: ReceiptSummary) -> ReceiptSummary? {
        if let shareCode = receipt.shareCode,
           let shared = receipts.first(where: { $0.shareCode == shareCode }) {
            return shared
        }
        return receipts.first { $0.id == receipt.id }
    }

    func customCategory(id: UUID) -> CustomTransactionCategory? {
        customCategories.first { $0.id == id }
    }

    func categoryPresentation(for transaction: FinanceTransaction) -> TransactionCategoryPresentation {
        if let customCategoryID = transaction.customCategoryID,
           let category = customCategory(id: customCategoryID) {
            return TransactionCategoryPresentation(
                id: "custom-\(category.id.uuidString)",
                title: category.title,
                systemImage: category.systemImage,
                colorHex: category.colorHex,
                builtIn: nil,
                customID: category.id
            )
        }
        return categoryPresentation(for: transaction.category)
    }

    func categoryPresentation(for category: TransactionCategory) -> TransactionCategoryPresentation {
        TransactionCategoryPresentation(
            id: "built-in-\(category.rawValue)",
            title: category.title,
            systemImage: category.systemImage,
            colorHex: category.colorHex,
            builtIn: category,
            customID: nil
        )
    }

    func categoryPresentations(for kind: FinanceTransactionKind) -> [TransactionCategoryPresentation] {
        let builtIns: [TransactionCategory]
        switch kind {
        case .expense:
            builtIns = [.food, .transport, .home, .health, .shopping, .entertainment, .other]
        case .income:
            builtIns = [.salary, .other]
        case .transfer:
            builtIns = [.transfer]
        }
        return builtIns.map { categoryPresentation(for: $0) } + customCategories
            .filter { $0.kind == kind }
            .map {
                TransactionCategoryPresentation(
                    id: "custom-\($0.id.uuidString)",
                    title: $0.title,
                    systemImage: $0.systemImage,
                    colorHex: $0.colorHex,
                    builtIn: nil,
                    customID: $0.id
                )
            }
    }

    @discardableResult
    func addCustomCategory(
        title: String,
        systemImage: String,
        colorHex: String,
        kind: FinanceTransactionKind
    ) -> CustomTransactionCategory? {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty, kind != .transfer else { return nil }
        let category = CustomTransactionCategory(
            title: trimmedTitle,
            systemImage: systemImage,
            colorHex: colorHex,
            kind: kind
        )
        customCategories.append(category)
        persist()
        return category
    }

    func addTransaction(
        kind: FinanceTransactionKind,
        amount: Double,
        walletID: UUID,
        destinationWalletID: UUID? = nil,
        category: TransactionCategory,
        customCategoryID: UUID? = nil,
        note: String,
        date: Date = .now
    ) {
        guard amount > 0, let sourceIndex = wallets.firstIndex(where: { $0.id == walletID }) else { return }

        let sourceCurrency = wallets[sourceIndex].currency
        var destinationAmount: Double?

        switch kind {
        case .expense:
            wallets[sourceIndex].balance -= amount
        case .income:
            wallets[sourceIndex].balance += amount
        case .transfer:
            guard let destinationWalletID,
                  destinationWalletID != walletID,
                  let destinationIndex = wallets.firstIndex(where: { $0.id == destinationWalletID }) else { return }
            wallets[sourceIndex].balance -= amount
            destinationAmount = converted(amount, from: sourceCurrency, to: wallets[destinationIndex].currency)
            wallets[destinationIndex].balance += destinationAmount ?? amount
        }

        transactions.append(
            FinanceTransaction(
                kind: kind,
                amount: amount,
                currency: sourceCurrency,
                category: kind == .transfer ? .transfer : category,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines),
                date: date,
                walletID: walletID,
                destinationWalletID: destinationWalletID,
                convertedAmount: destinationAmount,
                customCategoryID: kind == .transfer ? nil : customCategoryID
            )
        )
        persist()
    }

    func deleteTransaction(_ transaction: FinanceTransaction) {
        guard let sourceIndex = wallets.firstIndex(where: { $0.id == transaction.walletID }) else { return }

        switch transaction.kind {
        case .expense:
            wallets[sourceIndex].balance += transaction.amount
        case .income:
            wallets[sourceIndex].balance -= transaction.amount
        case .transfer:
            wallets[sourceIndex].balance += transaction.amount
            if let destinationWalletID = transaction.destinationWalletID,
               let destinationIndex = wallets.firstIndex(where: { $0.id == destinationWalletID }) {
                wallets[destinationIndex].balance -= transaction.convertedAmount ?? transaction.amount
            }
        }

        transactions.removeAll { $0.id == transaction.id }
        persist()
    }

    @discardableResult
    func createReceipt(
        for transaction: FinanceTransaction,
        merchant: String,
        authorName: String? = nil
    ) -> ReceiptSummary? {
        guard receipt(for: transaction.id) == nil else { return nil }
        let trimmedMerchant = merchant.trimmingCharacters(in: .whitespacesAndNewlines)
        let category = categoryPresentation(for: transaction)
        let receipt = ReceiptSummary(
            merchant: trimmedMerchant.isEmpty
                ? (transaction.note.isEmpty ? category.title : transaction.note)
                : trimmedMerchant,
            amount: transaction.amount,
            currency: transaction.currency,
            date: transaction.date,
            transactionID: transaction.id,
            categoryTitle: category.title,
            categorySystemImage: category.systemImage,
            transactionKind: transaction.kind,
            note: transaction.note,
            walletName: wallet(id: transaction.walletID)?.name,
            authorName: authorName,
            createdAt: .now
        )
        receipts.append(receipt)
        persist()
        return receipt
    }

    func markReceiptShared(id: UUID, shareCode: String) {
        guard let index = receipts.firstIndex(where: { $0.id == id }) else { return }
        receipts[index].isShared = true
        receipts[index].shareCode = shareCode
        persist()
    }

    @discardableResult
    func saveSharedReceipt(_ receipt: ReceiptSummary) -> ReceiptSummary {
        if let existing = savedReceipt(matching: receipt) {
            return existing
        }
        let saved = ReceiptSummary(
            merchant: receipt.merchant,
            amount: receipt.amount,
            currency: receipt.currency,
            date: receipt.date,
            isShared: true,
            transactionID: nil,
            categoryTitle: receipt.categoryTitle,
            categorySystemImage: receipt.categorySystemImage,
            transactionKind: receipt.transactionKind,
            note: receipt.note,
            walletName: receipt.walletName,
            authorName: receipt.authorName,
            shareCode: receipt.shareCode,
            createdAt: receipt.createdAt
        )
        receipts.append(saved)
        persist()
        return saved
    }

    func deleteReceipt(id: UUID) {
        receipts.removeAll { $0.id == id }
        persist()
    }

    func addWallet(name: String, currency: Currency, balance: Double) {
        let palette = WalletPalette.allCases[wallets.count % WalletPalette.allCases.count]
        wallets.append(
            Wallet(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                currency: currency,
                balance: balance,
                palette: palette
            )
        )
        persist()
    }

    func setBudgetLimit(_ amount: Double) {
        budgetLimit = max(0, amount)
        persist()
    }

    func setMainCurrency(_ currency: Currency) {
        mainCurrency = currency
        persist()
    }

    func setDarkAppearance(_ enabled: Bool) {
        prefersDarkAppearance = enabled
        persist()
    }

    func addGoal(title: String, target: Double, currency: Currency, dueDate: Date?) {
        guard target > 0 else { return }
        goals.append(SavingsGoal(title: title, targetAmount: target, currency: currency, dueDate: dueDate))
        persist()
    }

    @discardableResult
    func topUpGoal(id: UUID, amount: Double, sourceWalletID: UUID? = nil) -> Bool {
        guard amount > 0, let goalIndex = goals.firstIndex(where: { $0.id == id }) else { return false }
        let remainingAmount = max(0, goals[goalIndex].targetAmount - goals[goalIndex].savedAmount)
        let contribution = min(amount, remainingAmount)
        guard contribution > 0 else { return false }

        if let sourceWalletID {
            guard let walletIndex = wallets.firstIndex(where: { $0.id == sourceWalletID }) else { return false }
            let debit = converted(contribution, from: goals[goalIndex].currency, to: wallets[walletIndex].currency)
            wallets[walletIndex].balance -= debit
        }

        goals[goalIndex].savedAmount += contribution
        persist()
        return true
    }

    func addDebt(person: String, amount: Double, currency: Currency, direction: DebtDirection, dueDate: Date?) {
        guard amount > 0 else { return }
        debts.append(DebtItem(person: person, amount: amount, currency: currency, direction: direction, dueDate: dueDate))
        persist()
    }

    @discardableResult
    func settleDebt(id: UUID, walletID: UUID? = nil) -> Bool {
        guard let debtIndex = debts.firstIndex(where: { $0.id == id }), !debts[debtIndex].isPaid else { return false }

        if let walletID {
            guard let walletIndex = wallets.firstIndex(where: { $0.id == walletID }) else { return false }
            let walletAmount = converted(
                debts[debtIndex].amount,
                from: debts[debtIndex].currency,
                to: wallets[walletIndex].currency
            )
            switch debts[debtIndex].direction {
            case .owedToMe:
                wallets[walletIndex].balance += walletAmount
            case .iOwe:
                wallets[walletIndex].balance -= walletAmount
            }

            let debt = debts[debtIndex]
            transactions.append(
                FinanceTransaction(
                    kind: debt.direction == .owedToMe ? .income : .expense,
                    amount: walletAmount,
                    currency: wallets[walletIndex].currency,
                    category: .other,
                    note: debt.direction == .owedToMe
                        ? "Повернення боргу від \(debt.person)"
                        : "Погашення боргу для \(debt.person)",
                    walletID: walletID,
                    sourceDebtID: debt.id
                )
            )
        }

        debts[debtIndex].isPaid = true
        persist()
        return true
    }

    var snapshot: PlanerSnapshot {
        PlanerSnapshot(
            wallets: wallets,
            transactions: transactions,
            goals: goals,
            debts: debts,
            receipts: receipts,
            customCategories: customCategories,
            budgetLimit: budgetLimit,
            mainCurrency: mainCurrency,
            prefersDarkAppearance: prefersDarkAppearance,
            activeSpaceName: activeSpaceName
        )
    }

    func setChangeHandler(_ handler: ((PlanerSnapshot) -> Void)?) {
        changeHandler = handler
    }

    func replace(with snapshot: PlanerSnapshot, notifyChange: Bool = false) {
        wallets = snapshot.wallets
        transactions = snapshot.transactions
        goals = snapshot.goals
        debts = snapshot.debts
        receipts = snapshot.receipts
        customCategories = snapshot.customCategories
        budgetLimit = snapshot.budgetLimit
        mainCurrency = snapshot.mainCurrency
        prefersDarkAppearance = snapshot.prefersDarkAppearance
        activeSpaceName = snapshot.activeSpaceName
        persist(notifyChange: notifyChange)
    }

    func clearAllData() {
        replace(with: .empty, notifyChange: true)
    }

    func converted(_ amount: Double, from: Currency, to: Currency) -> Double {
        guard from != to else { return amount }
        let inUAH: Double
        switch from {
        case .UAH: inUAH = amount
        case .USD: inUAH = amount * 41.2
        case .EUR: inUAH = amount * 45.0
        }

        switch to {
        case .UAH: return inUAH
        case .USD: return inUAH / 41.2
        case .EUR: return inUAH / 45.0
        }
    }

    func categoryTotals(for transactions: [FinanceTransaction]) -> [CategoryTotal] {
        let totals = Dictionary(
            grouping: transactions.filter { $0.kind == .expense },
            by: { categoryPresentation(for: $0) }
        )
            .mapValues { rows in
                rows.reduce(0) { $0 + converted($1.amount, from: $1.currency, to: mainCurrency) }
            }
        return totals
            .map {
                CategoryTotal(
                    id: $0.key.id,
                    title: $0.key.title,
                    systemImage: $0.key.systemImage,
                    colorHex: $0.key.colorHex,
                    amount: $0.value
                )
            }
            .sorted { $0.amount > $1.amount }
    }

    private func persist(notifyChange: Bool = true) {
        guard persistsChanges else { return }
        let currentSnapshot = snapshot
        guard let data = try? JSONEncoder().encode(currentSnapshot) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
        if notifyChange {
            changeHandler?(currentSnapshot)
        }
    }

    static func previewStore() -> FinanceStore {
        FinanceStore(snapshot: sampleSnapshot(), loadPersisted: false, persistsChanges: false)
    }

    private static func sampleSnapshot() -> PlanerSnapshot {
        let mono = Wallet(name: "Монобанк", currency: .UAH, balance: 28_340.50, palette: .violet)
        let travel = Wallet(name: "Подорожі", currency: .EUR, balance: 640, palette: .blue)
        let reserve = Wallet(name: "Резерв", currency: .USD, balance: 1_820, palette: .graphite)
        let calendar = Calendar.current
        let daysAgo: (Int) -> Date = { calendar.date(byAdding: .day, value: -$0, to: .now) ?? .now }

        return PlanerSnapshot(
            wallets: [mono, travel, reserve],
            transactions: [
                FinanceTransaction(kind: .expense, amount: 680, currency: .UAH, category: .food, note: "Сільпо", date: daysAgo(0), walletID: mono.id),
                FinanceTransaction(kind: .expense, amount: 320, currency: .UAH, category: .transport, note: "Таксі", date: daysAgo(0), walletID: mono.id),
                FinanceTransaction(kind: .income, amount: 42_000, currency: .UAH, category: .salary, note: "Зарплата", date: daysAgo(2), walletID: mono.id),
                FinanceTransaction(kind: .expense, amount: 84, currency: .EUR, category: .entertainment, note: "Концерт", date: daysAgo(4), walletID: travel.id),
                FinanceTransaction(kind: .expense, amount: 145, currency: .USD, category: .shopping, note: "Техніка", date: daysAgo(8), walletID: reserve.id),
                FinanceTransaction(kind: .expense, amount: 1_240, currency: .UAH, category: .home, note: "Для дому", date: daysAgo(12), walletID: mono.id)
            ],
            goals: [
                SavingsGoal(title: "MacBook Pro", targetAmount: 95_000, savedAmount: 38_500, currency: .UAH),
                SavingsGoal(title: "Відпустка", targetAmount: 2_400, savedAmount: 1_080, currency: .EUR, dueDate: calendar.date(byAdding: .month, value: 5, to: .now))
            ],
            debts: [
                DebtItem(person: "Олексій", amount: 2_500, currency: .UAH, direction: .owedToMe, dueDate: daysAgo(-7)),
                DebtItem(person: "Марія", amount: 80, currency: .EUR, direction: .iOwe)
            ],
            receipts: [
                ReceiptSummary(id: UUID(), merchant: "Сільпо", amount: 680, currency: .UAH, date: daysAgo(0), isShared: true),
                ReceiptSummary(id: UUID(), merchant: "Rozetka", amount: 3_890, currency: .UAH, date: daysAgo(5), isShared: false)
            ],
            budgetLimit: 35_000,
            mainCurrency: .UAH,
            prefersDarkAppearance: true,
            activeSpaceName: "Особистий бюджет"
        )
    }
}
