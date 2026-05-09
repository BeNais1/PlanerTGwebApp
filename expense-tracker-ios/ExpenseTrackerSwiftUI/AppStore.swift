import Foundation
import Combine

final class AppStore: ObservableObject {
    @Published private(set) var transactions: [TransactionItem] = []
    @Published private(set) var receipts: [ReceiptItem] = []
    @Published var settings = UserSettings() {
        didSet { save() }
    }

    private let storageKey = "expense-tracker-swiftui-state-v1"

    init() {
        load()
    }

    var currentBalance: Double {
        transactions.reduce(0) { total, item in
            guard !item.excludedFromBalance else { return total }
            let amount = convert(item.amount, from: item.currency, to: settings.mainCurrency)
            return item.kind == .income ? total + amount : total - amount
        }
    }

    var periodExpenses: Double {
        let calendar = Calendar.current
        let now = Date()
        let startDate: Date

        switch settings.budgetPeriod {
        case .day:
            startDate = calendar.startOfDay(for: now)
        case .week:
            startDate = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        case .month:
            startDate = calendar.dateInterval(of: .month, for: now)?.start ?? now
        }

        return transactions
            .filter { $0.kind == .expense && !$0.excludedFromBalance && $0.date >= startDate }
            .reduce(0) { $0 + convert($1.amount, from: $1.currency, to: settings.mainCurrency) }
    }

    var todayTransactions: [TransactionItem] {
        transactions
            .filter { Calendar.current.isDateInToday($0.date) }
            .sorted { $0.date > $1.date }
    }

    var groupedHistory: [(String, [TransactionItem])] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateStyle = .medium

        let grouped = Dictionary(grouping: transactions.sorted { $0.date > $1.date }) {
            formatter.string(from: $0.date)
        }

        return grouped
            .map { ($0.key, $0.value) }
            .sorted { ($0.1.first?.date ?? .distantPast) > ($1.1.first?.date ?? .distantPast) }
    }

    func addTransaction(kind: TransactionKind, amount: Double, currency: CurrencyCode, category: String, note: String, date: Date) {
        let item = TransactionItem(kind: kind, amount: amount, currency: currency, category: category, note: note, date: date)
        transactions.insert(item, at: 0)
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

    func convert(_ amount: Double, from: CurrencyCode, to: CurrencyCode) -> Double {
        guard from != to else { return amount }
        let eurRates: [CurrencyCode: Double] = [.eur: 1, .usd: 1.08, .uah: 45.2]
        let amountInEur = amount / (eurRates[from] ?? 1)
        return amountInEur * (eurRates[to] ?? 1)
    }

    func formatted(_ value: Double, currency: CurrencyCode? = nil) -> String {
        let code = currency ?? settings.mainCurrency
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code.rawValue
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(code.symbol)\(value)"
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
    }

    private func save() {
        let state = PersistedState(transactions: transactions, receipts: receipts, settings: settings)
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func seedDemoData() {
        transactions = [
            .init(kind: .income, amount: 2400, currency: .eur, category: "Доход", note: "Пополнение", date: .now.addingTimeInterval(-3600 * 5)),
            .init(kind: .expense, amount: 28.40, currency: .eur, category: "Еда", note: "Кофе и обед", date: .now.addingTimeInterval(-3600 * 2)),
            .init(kind: .expense, amount: 1200, currency: .uah, category: "Транспорт", note: "Такси", date: .now.addingTimeInterval(-86400))
        ]
        receipts = [
            .init(title: "Обед с друзьями", merchant: "Urban Bistro", amount: 64.90, currency: .eur, date: .now.addingTimeInterval(-7200))
        ]
        save()
    }
}

private struct PersistedState: Codable {
    var transactions: [TransactionItem]
    var receipts: [ReceiptItem]
    var settings: UserSettings
}
