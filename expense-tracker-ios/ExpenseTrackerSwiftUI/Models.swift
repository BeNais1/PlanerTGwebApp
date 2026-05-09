import Foundation
import SwiftUI

enum TransactionKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case expense
    case income

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense:
            return "Расход"
        case .income:
            return "Доход"
        }
    }

    var sign: String {
        switch self {
        case .expense:
            return "-"
        case .income:
            return "+"
        }
    }
}

enum CurrencyCode: String, Codable, CaseIterable, Identifiable, Hashable {
    case eur = "EUR"
    case usd = "USD"
    case uah = "UAH"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .eur:
            return "€"
        case .usd:
            return "$"
        case .uah:
            return "₴"
        }
    }
}

enum BudgetPeriod: String, Codable, CaseIterable, Identifiable, Hashable {
    case day
    case week
    case month

    var id: String { rawValue }

    var title: String {
        switch self {
        case .day:
            return "День"
        case .week:
            return "Неделя"
        case .month:
            return "Месяц"
        }
    }
}

struct TransactionItem: Identifiable, Codable, Hashable {
    var id = UUID()
    var kind: TransactionKind
    var amount: Double
    var currency: CurrencyCode
    var category: String
    var note: String
    var date: Date
    var excludedFromBalance: Bool = false
}

struct ReceiptItem: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var merchant: String
    var amount: Double
    var currency: CurrencyCode
    var date: Date
}

struct HistorySection: Identifiable, Hashable {
    let title: String
    let items: [TransactionItem]

    var id: String { title }
}

struct UserSettings: Codable, Hashable {
    var mainCurrency: CurrencyCode = .eur
    var budgetLimit: Double = 1200
    var budgetPeriod: BudgetPeriod = .month
}

struct Category: Identifiable, Hashable {
    var id: String { title }
    let title: String
    let symbol: String
    let color: Color
}

let expenseCategories: [Category] = [
    .init(title: "Еда", symbol: "fork.knife", color: .mint),
    .init(title: "Транспорт", symbol: "tram.fill", color: .cyan),
    .init(title: "Дом", symbol: "house.fill", color: .orange),
    .init(title: "Подписки", symbol: "play.rectangle.fill", color: .purple),
    .init(title: "Покупки", symbol: "bag.fill", color: .pink),
    .init(title: "Другое", symbol: "sparkles", color: .blue)
]
