import Foundation
import SwiftUI

enum TransactionKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case expense
    case income

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Expense"
        case .income: return "Income"
        }
    }

    var sign: String {
        switch self {
        case .expense: return "-"
        case .income: return "+"
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
        case .eur: return "€"
        case .usd: return "$"
        case .uah: return "₴"
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
        case .day: return "Day"
        case .week: return "Week"
        case .month: return "Month"
        }
    }
}

enum SubscriptionPeriod: String, Codable, CaseIterable, Identifiable, Hashable {
    case weekly
    case monthly
    case yearly

    var id: String { rawValue }

    var title: String {
        switch self {
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        case .yearly: return "Yearly"
        }
    }
}

enum DebtDirection: String, Codable, CaseIterable, Identifiable, Hashable {
    case owedToMe
    case iOwe

    var id: String { rawValue }

    var title: String {
        switch self {
        case .owedToMe: return "Owed to me"
        case .iOwe: return "I owe"
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
    var jointCheckId: String?
    var isJointCheck: Bool = false
}

struct ReceiptItem: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var merchant: String
    var amount: Double
    var currency: CurrencyCode
    var date: Date
}

struct SmartGoal: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var targetAmount: Double
    var savedAmount: Double
    var currency: CurrencyCode
    var dueDate: Date?
    var createdAt: Date = .now
}

struct DebtItem: Identifiable, Codable, Hashable {
    var id = UUID()
    var person: String
    var amount: Double
    var currency: CurrencyCode
    var direction: DebtDirection
    var dueDate: Date?
    var note: String = ""
    var isPaid: Bool = false
    var createdAt: Date = .now
}

struct SubscriptionItem: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var amount: Double
    var currency: CurrencyCode
    var category: String
    var icon: String
    var period: SubscriptionPeriod
    var nextDate: Date
    var createdAt: Date = .now
    var isActive: Bool = true
}

struct HistorySection: Identifiable, Hashable {
    let title: String
    let items: [TransactionItem]

    var id: String { title }
}

struct UserSettings: Codable, Hashable {
    var mainCurrency: CurrencyCode = .eur
    var walletNames: [String: String] = [:]
    var budgetLimit: Double = 1200
    var budgetPeriod: BudgetPeriod = .month
    var budgetLimitIncludePrior: Bool = true
    var budgetLimitStartDate: Date?
    var onboardingCompleted: Bool = true
    var theme: String = "dark"
    var smartGoals: [SmartGoal] = []
    var debts: [DebtItem] = []
    var subscriptions: [SubscriptionItem] = []

    private enum CodingKeys: String, CodingKey {
        case mainCurrency
        case walletNames
        case budgetLimit
        case budgetPeriod
        case budgetLimitIncludePrior
        case budgetLimitStartDate
        case onboardingCompleted
        case theme
        case smartGoals
        case debts
        case subscriptions
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mainCurrency = try container.decodeIfPresent(CurrencyCode.self, forKey: .mainCurrency) ?? .eur
        walletNames = try container.decodeIfPresent([String: String].self, forKey: .walletNames) ?? [:]
        budgetLimit = try container.decodeIfPresent(Double.self, forKey: .budgetLimit) ?? 1200
        budgetPeriod = try container.decodeIfPresent(BudgetPeriod.self, forKey: .budgetPeriod) ?? .month
        budgetLimitIncludePrior = try container.decodeIfPresent(Bool.self, forKey: .budgetLimitIncludePrior) ?? true
        budgetLimitStartDate = try container.decodeIfPresent(Date.self, forKey: .budgetLimitStartDate)
        onboardingCompleted = try container.decodeIfPresent(Bool.self, forKey: .onboardingCompleted) ?? true
        theme = try container.decodeIfPresent(String.self, forKey: .theme) ?? "dark"
        smartGoals = try container.decodeIfPresent([SmartGoal].self, forKey: .smartGoals) ?? []
        debts = try container.decodeIfPresent([DebtItem].self, forKey: .debts) ?? []
        subscriptions = try container.decodeIfPresent([SubscriptionItem].self, forKey: .subscriptions) ?? []
    }
}

struct Category: Identifiable, Hashable {
    let id: String
    let title: String
    let symbol: String
    let color: Color
}

let expenseCategories: [Category] = [
    .init(id: "food", title: "Food", symbol: "fork.knife", color: .mint),
    .init(id: "cafe", title: "Cafe", symbol: "cup.and.saucer.fill", color: .cyan),
    .init(id: "transport", title: "Transport", symbol: "car.fill", color: .orange),
    .init(id: "home", title: "Home", symbol: "house.fill", color: .blue),
    .init(id: "subscriptions", title: "Subscriptions", symbol: "play.rectangle.fill", color: .purple),
    .init(id: "shopping", title: "Shopping", symbol: "bag.fill", color: .pink),
    .init(id: "health", title: "Health", symbol: "cross.case.fill", color: .red),
    .init(id: "entertainment", title: "Entertainment", symbol: "gamecontroller.fill", color: .teal),
    .init(id: "other", title: "Other", symbol: "sparkles", color: .gray)
]

let categoryKeywordSuggestions: [String: [String]] = [
    "food": ["market", "grocery", "silpo", "atb", "novus", "food"],
    "cafe": ["coffee", "cafe", "starbucks", "restaurant", "pizza", "bar"],
    "transport": ["uber", "bolt", "taxi", "metro", "bus", "fuel", "wog", "okko"],
    "home": ["rent", "internet", "water", "gas", "utility"],
    "health": ["pharmacy", "doctor", "clinic", "health"],
    "entertainment": ["cinema", "netflix", "spotify", "steam", "playstation"],
    "shopping": ["shop", "store", "amazon", "rozetka", "mall"],
    "subscriptions": ["subscription", "icloud", "youtube", "chatgpt"]
]
