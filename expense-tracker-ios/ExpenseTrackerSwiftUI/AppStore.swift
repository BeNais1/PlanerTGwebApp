import Foundation
import Combine
import FirebaseAuth
import FirebaseDatabase

final class AppStore: ObservableObject {
    @Published private(set) var transactions: [TransactionItem] = []
    @Published private(set) var receipts: [ReceiptItem] = []
    @Published var settings = UserSettings() {
        didSet { save() }
    }

    private let storageKey = "expense-tracker-swiftui-state-v2"
    private var authStateListener: AuthStateDidChangeListenerHandle?
    private var stateObserverHandle: DatabaseHandle?
    private var activeUserID: String?
    private var isApplyingRemoteState = false
    private var pendingSave: DispatchWorkItem?

    init() {
        FirebaseBootstrap.configureIfNeeded()
        load()
        observeAuthState()
    }

    deinit {
        if let listener = authStateListener {
            Auth.auth().removeStateDidChangeListener(listener)
        }
        detachStateObserver()
    }

    var allCategories: [Category] {
        let visibleDefaults = defaultExpenseCategories.filter { !settings.hiddenCategoryIds.contains($0.id) }
        return visibleDefaults + settings.customCategories
    }

    var allWalletBalances: [CurrencyCode: Double] {
        var balances: [CurrencyCode: Double] = [:]
        for code in settings.enabledCurrencies {
            balances[code] = 0
        }
        if balances[settings.mainCurrency] == nil {
            balances[settings.mainCurrency] = 0
        }

        for item in transactions where !item.excludedFromBalance {
            if balances[item.currency] == nil {
                balances[item.currency] = 0
            }
            if item.kind == .income {
                balances[item.currency, default: 0] += item.amount
            } else {
                balances[item.currency, default: 0] -= item.amount
            }
        }
        return balances
    }

    var currentBalance: Double {
        allWalletBalances.reduce(0) { total, pair in
            total + convert(pair.value, from: pair.key, to: settings.mainCurrency)
        }
    }

    var periodExpenses: Double {
        let startDate = periodStart(for: settings.budgetPeriod, relativeTo: Date())
        return transactions
            .filter { $0.kind == .expense && !$0.excludedFromBalance && $0.date >= startDate }
            .reduce(0) { $0 + convert($1.amount, from: $1.currency, to: settings.mainCurrency) }
    }

    var periodIncome: Double {
        let startDate = periodStart(for: settings.budgetPeriod, relativeTo: Date())
        return transactions
            .filter { $0.kind == .income && !$0.excludedFromBalance && $0.date >= startDate }
            .reduce(0) { $0 + convert($1.amount, from: $1.currency, to: settings.mainCurrency) }
    }

    var todayTransactions: [TransactionItem] {
        transactions
            .filter { Calendar.current.isDateInToday($0.date) }
            .sorted { $0.date > $1.date }
    }

    var groupedHistory: [HistorySection] {
        let grouped = Dictionary(grouping: transactions.sorted { $0.date > $1.date }) {
            AppLocale.relativeDay(for: $0.date)
        }

        return grouped
            .map { HistorySection(title: $0.key, items: $0.value) }
            .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
    }

    var monthlyTransactions: [TransactionItem] {
        let monthStart = Calendar.current.dateInterval(of: .month, for: Date())?.start ?? .distantPast
        return transactions.filter { $0.date >= monthStart }
    }

    func walletName(for currency: CurrencyCode) -> String {
        settings.walletNames[currency.rawValue] ?? currency.defaultWalletName
    }

    func balance(for currency: CurrencyCode) -> Double {
        allWalletBalances[currency] ?? 0
    }

    func addTransaction(kind: TransactionKind, amount: Double, currency: CurrencyCode, category: String, note: String, date: Date) {
        let item = TransactionItem(kind: kind, amount: amount, currency: currency, category: category, note: note, date: date)
        transactions.insert(item, at: 0)
        save()
    }

    func updateTransaction(_ item: TransactionItem) {
        guard let index = transactions.firstIndex(where: { $0.id == item.id }) else { return }
        transactions[index] = item
        save()
    }

    func deleteTransaction(_ item: TransactionItem) {
        transactions.removeAll { $0.id == item.id }
        save()
    }

    func addReceipt(title: String, merchant: String, amount: Double, currency: CurrencyCode) {
        receipts.insert(.init(title: title, merchant: merchant, amount: amount, currency: currency, date: Date()), at: 0)
        save()
    }

    func removeReceipt(_ receipt: ReceiptItem) {
        receipts.removeAll { $0.id == receipt.id }
        save()
    }

    func attachShareCode(_ code: String, toReceipt receiptID: UUID) {
        guard let index = receipts.firstIndex(where: { $0.id == receiptID }) else { return }
        receipts[index].shareCode = code
        save()
    }

    func addGoal(title: String, targetAmount: Double, savedAmount: Double, dueDate: Date?, emoji: String) {
        let goal = SmartGoal(
            title: title,
            targetAmount: max(targetAmount, 0),
            savedAmount: min(max(savedAmount, 0), max(targetAmount, 0)),
            currency: settings.mainCurrency,
            dueDate: dueDate,
            emoji: emoji
        )
        settings.smartGoals.insert(goal, at: 0)
    }

    func removeGoal(_ goal: SmartGoal) {
        settings.smartGoals.removeAll { $0.id == goal.id }
    }

    func topUpGoal(_ goal: SmartGoal, amount: Double) {
        guard let index = settings.smartGoals.firstIndex(where: { $0.id == goal.id }) else { return }
        let nextValue = min(settings.smartGoals[index].targetAmount, settings.smartGoals[index].savedAmount + max(0, amount))
        settings.smartGoals[index].savedAmount = nextValue
    }

    func addDebt(person: String, amount: Double, currency: CurrencyCode, dueDate: Date?, direction: DebtDirection, note: String) {
        let debt = DebtItem(
            person: person,
            amount: max(0, amount),
            currency: currency,
            direction: direction,
            dueDate: dueDate,
            note: note
        )
        settings.debts.insert(debt, at: 0)
    }

    func toggleDebtPaid(_ debt: DebtItem) {
        guard let index = settings.debts.firstIndex(where: { $0.id == debt.id }) else { return }
        settings.debts[index].isPaid.toggle()
    }

    func removeDebt(_ debt: DebtItem) {
        settings.debts.removeAll { $0.id == debt.id }
    }

    func addSubscription(name: String, amount: Double, currency: CurrencyCode, category: String, icon: String, colorHex: UInt, period: SubscriptionPeriod, nextDate: Date) {
        let colorString = String(format: "%06X", colorHex)
        let subscription = SubscriptionItem(
            name: name,
            amount: max(0, amount),
            currency: currency,
            category: category,
            icon: icon,
            color: colorString,
            period: period,
            nextDate: nextDate
        )
        settings.subscriptions.insert(subscription, at: 0)
    }

    func toggleSubscriptionActive(_ subscription: SubscriptionItem) {
        guard let index = settings.subscriptions.firstIndex(where: { $0.id == subscription.id }) else { return }
        settings.subscriptions[index].isActive.toggle()
    }

    func removeSubscription(_ subscription: SubscriptionItem) {
        settings.subscriptions.removeAll { $0.id == subscription.id }
    }

    func addJointCheck(title: String, totalAmount: Double, currency: CurrencyCode, participants: [JointCheckParticipant]) -> JointCheck {
        let check = JointCheck(
            title: title,
            totalAmount: totalAmount,
            currency: currency,
            participants: participants
        )
        settings.jointChecks.insert(check, at: 0)
        return check
    }

    func recordPayment(checkId: UUID, participantId: UUID, amount: Double) {
        guard let index = settings.jointChecks.firstIndex(where: { $0.id == checkId }) else { return }
        settings.jointChecks[index].payments.append(.init(participantId: participantId, amount: amount))
    }

    func closeJointCheck(_ check: JointCheck) {
        guard let index = settings.jointChecks.firstIndex(where: { $0.id == check.id }) else { return }
        settings.jointChecks[index].isClosed = true
    }

    func removeJointCheck(_ check: JointCheck) {
        settings.jointChecks.removeAll { $0.id == check.id }
    }

    func toggleCategoryHidden(_ category: Category) {
        if settings.hiddenCategoryIds.contains(category.id) {
            settings.hiddenCategoryIds.removeAll { $0 == category.id }
        } else {
            settings.hiddenCategoryIds.append(category.id)
        }
    }

    func addCustomCategory(title: String, symbol: String, colorHex: UInt) {
        let id = title.lowercased().trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "-")
        guard !id.isEmpty, !settings.customCategories.contains(where: { $0.id == id }) else { return }
        settings.customCategories.append(.init(id: id, title: title, symbol: symbol, colorHex: colorHex))
    }

    func renameWallet(currency: CurrencyCode, name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        settings.walletNames[currency.rawValue] = trimmed
    }

    func completeOnboarding(gender: Gender?, age: Int?, isMarried: Bool?, hasPets: Bool?) {
        settings.onboarding = .init(
            gender: gender,
            age: age,
            isMarried: isMarried,
            hasPets: hasPets,
            completedAt: .now
        )
        settings.onboardingCompleted = true
    }

    func convert(_ amount: Double, from: CurrencyCode, to: CurrencyCode) -> Double {
        guard from != to else { return amount }
        let eurRates: [CurrencyCode: Double] = [.eur: 1, .usd: 1.08, .uah: 45.2]
        let amountInEur = amount / (eurRates[from] ?? 1)
        return amountInEur * (eurRates[to] ?? 1)
    }

    func formatted(_ value: Double, currency: CurrencyCode? = nil) -> String {
        let code = currency ?? settings.mainCurrency
        let formatter = NumberFormatter()
        formatter.locale = AppLocale.locale
        formatter.numberStyle = .currency
        formatter.currencyCode = code.rawValue
        formatter.currencySymbol = code.symbol
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(code.symbol)\(value)"
    }

    func suggestedCategory(for description: String) -> String? {
        let text = description.lowercased()
        guard !text.isEmpty else { return nil }

        for pair in categoryKeywordSuggestions {
            if pair.value.contains(where: { text.contains($0) }) {
                return pair.key
            }
        }
        return nil
    }

    func transactionsInRange(_ range: AnalyticsDateRange, currencyFilter: CurrencyCode?, typeFilter: AnalyticsTypeFilter, categoryFilter: String?) -> [TransactionItem] {
        let bounds = range.bounds(relativeTo: Date())
        return transactions.filter { item in
            if item.excludedFromBalance { return false }
            if item.date < bounds.start || item.date > bounds.end { return false }
            if let currencyFilter, item.currency != currencyFilter { return false }
            if typeFilter != .all && item.kind != typeFilter.transactionKind { return false }
            if let categoryFilter, item.category != categoryFilter { return false }
            return true
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let state = try? JSONDecoder().decode(PersistedState.self, from: data) else {
            seedDemoData()
            return
        }

        transactions = state.transactions
        receipts = state.receipts
        settings = state.settings
        normalizeLegacyData()
    }

    private func save() {
        let state = PersistedState(transactions: transactions, receipts: receipts, settings: settings)
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)

        guard !isApplyingRemoteState else { return }
        scheduleSyncToFirebase(state)
    }

    private func scheduleSyncToFirebase(_ state: PersistedState) {
        pendingSave?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.syncToFirebase(state)
        }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
    }

    private func observeAuthState() {
        authStateListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.handleAuthState(user)
        }
    }

    private func handleAuthState(_ user: User?) {
        let nextUserID = user?.uid
        guard nextUserID != activeUserID else { return }

        detachStateObserver()
        activeUserID = nextUserID
        guard let uid = nextUserID else { return }
        attachStateObserver(uid: uid)
    }

    private func databaseReference(for uid: String) -> DatabaseReference {
        Database.database(url: FirebaseClientConfig.databaseURL)
            .reference()
            .child("users")
            .child(uid)
            .child("swiftui_state")
    }

    private func attachStateObserver(uid: String) {
        let ref = databaseReference(for: uid)
        stateObserverHandle = ref.observe(.value) { [weak self] snapshot in
            guard let self else { return }

            guard snapshot.exists(), let raw = snapshot.value, !(raw is NSNull) else {
                self.syncToFirebase(PersistedState(transactions: self.transactions, receipts: self.receipts, settings: self.settings))
                return
            }

            do {
                let data = try JSONSerialization.data(withJSONObject: raw)
                let cloudState = try JSONDecoder().decode(PersistedState.self, from: data)
                DispatchQueue.main.async {
                    self.isApplyingRemoteState = true
                    self.transactions = cloudState.transactions
                    self.receipts = cloudState.receipts
                    self.settings = cloudState.settings
                    self.isApplyingRemoteState = false
                }
            } catch {
                print("Failed to decode Firebase state: \(error.localizedDescription)")
            }
        }
    }

    private func detachStateObserver() {
        if let handle = stateObserverHandle, let uid = activeUserID {
            databaseReference(for: uid).removeObserver(withHandle: handle)
        }
        stateObserverHandle = nil
    }

    private func syncToFirebase(_ state: PersistedState) {
        guard let uid = activeUserID else { return }

        do {
            let data = try JSONEncoder().encode(state)
            let object = try JSONSerialization.jsonObject(with: data)
            databaseReference(for: uid).setValue(object)
        } catch {
            print("Failed to sync Firebase state: \(error.localizedDescription)")
        }
    }

    private func periodStart(for period: BudgetPeriod, relativeTo date: Date) -> Date {
        let calendar = Calendar.current
        switch period {
        case .day:
            return calendar.startOfDay(for: date)
        case .week:
            return calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
        case .month:
            return calendar.dateInterval(of: .month, for: date)?.start ?? date
        }
    }

    private func seedDemoData() {
        settings.onboardingCompleted = false
        transactions = [
            .init(kind: .income, amount: 2400, currency: .eur, category: "income", note: "Зарплата", date: .now.addingTimeInterval(-3600.0 * 8.0)),
            .init(kind: .expense, amount: 39.20, currency: .eur, category: "food", note: "Сільпо", date: .now.addingTimeInterval(-3600.0 * 4.0)),
            .init(kind: .expense, amount: 520, currency: .uah, category: "transport", note: "Таксі", date: .now.addingTimeInterval(-86400.0)),
            .init(kind: .expense, amount: 12.50, currency: .eur, category: "cafe", note: "Кава", date: .now.addingTimeInterval(-3600.0 * 2.0))
        ]
        receipts = [
            .init(title: "Обід", merchant: "Urban Bistro", amount: 18.90, currency: .eur, date: .now.addingTimeInterval(-7200.0))
        ]
        settings.smartGoals = [
            .init(title: "Новий MacBook", targetAmount: 1500, savedAmount: 320, currency: .eur, dueDate: Calendar.current.date(byAdding: .month, value: 3, to: .now), emoji: "💻")
        ]
        settings.debts = [
            .init(person: "Олексій", amount: 50, currency: .eur, direction: .owedToMe, dueDate: Calendar.current.date(byAdding: .day, value: 7, to: .now))
        ]
        settings.subscriptions = [
            .init(name: "Netflix", amount: 12.99, currency: .eur, category: "subscriptions", icon: "play.tv.fill", color: "E50914", period: .monthly, nextDate: Calendar.current.date(byAdding: .day, value: 10, to: .now) ?? .now)
        ]
        save()
    }

    private func normalizeLegacyData() {
        let map: [String: String] = [
            "Доход": "income",
            "Income": "income",
            "Еда": "food",
            "Food": "food",
            "Транспорт": "transport",
            "Transport": "transport",
            "Дом": "home",
            "Home": "home",
            "Подписки": "subscriptions",
            "Subscriptions": "subscriptions",
            "Покупки": "shopping",
            "Shopping": "shopping",
            "Другое": "other",
            "Other": "other"
        ]

        var needsSave = false
        var normalized = transactions
        for index in normalized.indices {
            let current = normalized[index].category
            let fallback = normalized[index].kind == .income ? "income" : "other"
            let converted = map[current] ?? (current.isEmpty ? fallback : current)
            if converted != current {
                normalized[index].category = converted
                needsSave = true
            }
        }

        if needsSave {
            transactions = normalized
            save()
        }
    }
}

enum AnalyticsDateRange: String, CaseIterable, Identifiable {
    case week
    case month
    case quarter
    case year
    case all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .week: return "Тиждень"
        case .month: return "Місяць"
        case .quarter: return "Квартал"
        case .year: return "Рік"
        case .all: return "Весь час"
        }
    }

    func bounds(relativeTo date: Date) -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let end = date
        switch self {
        case .week:
            return (calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: end)) ?? .distantPast, end)
        case .month:
            return (calendar.dateInterval(of: .month, for: end)?.start ?? .distantPast, end)
        case .quarter:
            return (calendar.date(byAdding: .day, value: -89, to: calendar.startOfDay(for: end)) ?? .distantPast, end)
        case .year:
            return (calendar.dateInterval(of: .year, for: end)?.start ?? .distantPast, end)
        case .all:
            return (.distantPast, end)
        }
    }
}

enum AnalyticsTypeFilter: String, CaseIterable, Identifiable {
    case expense
    case income
    case all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Витрати"
        case .income: return "Доходи"
        case .all: return "Усе"
        }
    }

    var transactionKind: TransactionKind {
        switch self {
        case .expense: return .expense
        case .income: return .income
        case .all: return .expense
        }
    }
}

private struct PersistedState: Codable {
    var transactions: [TransactionItem]
    var receipts: [ReceiptItem]
    var settings: UserSettings
}
