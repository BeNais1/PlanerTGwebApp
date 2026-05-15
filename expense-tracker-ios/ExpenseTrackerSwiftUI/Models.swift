import Foundation
import SwiftUI

enum TransactionKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case expense
    case income

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: return "Витрата"
        case .income: return "Дохід"
        }
    }

    var pluralTitle: String {
        switch self {
        case .expense: return "Витрати"
        case .income: return "Доходи"
        }
    }

    var sign: String {
        switch self {
        case .expense: return "−"
        case .income: return "+"
        }
    }

    var tint: Color {
        switch self {
        case .expense: return Theme.Palette.expense
        case .income: return Theme.Palette.income
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

    var defaultWalletName: String {
        switch self {
        case .eur: return "Євро"
        case .usd: return "Долари"
        case .uah: return "Гривні"
        }
    }

    var accent: Color {
        switch self {
        case .eur: return Theme.Palette.indigo
        case .usd: return Theme.Palette.mint
        case .uah: return Theme.Palette.amber
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
        case .day: return "День"
        case .week: return "Тиждень"
        case .month: return "Місяць"
        }
    }

    var subtitle: String {
        switch self {
        case .day: return "на день"
        case .week: return "на тиждень"
        case .month: return "на місяць"
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
        case .weekly: return "Щотижня"
        case .monthly: return "Щомісяця"
        case .yearly: return "Щороку"
        }
    }
}

enum DebtDirection: String, Codable, CaseIterable, Identifiable, Hashable {
    case owedToMe
    case iOwe

    var id: String { rawValue }

    var title: String {
        switch self {
        case .owedToMe: return "Мені винні"
        case .iOwe: return "Я винен"
        }
    }

    var icon: String {
        switch self {
        case .owedToMe: return "arrow.down.left.circle.fill"
        case .iOwe: return "arrow.up.right.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .owedToMe: return Theme.Palette.mint
        case .iOwe: return Theme.Palette.rose
        }
    }
}

enum Gender: String, Codable, CaseIterable, Identifiable, Hashable {
    case male
    case female
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .male: return "Чоловік"
        case .female: return "Жінка"
        case .other: return "Інше"
        }
    }

    var icon: String {
        switch self {
        case .male: return "person.fill"
        case .female: return "person.fill"
        case .other: return "person.crop.circle"
        }
    }
}

enum ReceiptPrivacy: String, Codable, CaseIterable, Identifiable, Hashable {
    case publicMode = "public"
    case anonymous = "anonymous"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .publicMode: return "Публічний"
        case .anonymous: return "Анонімний"
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
    var shareCode: String?
}

struct SmartGoal: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var targetAmount: Double
    var savedAmount: Double
    var currency: CurrencyCode
    var dueDate: Date?
    var emoji: String = "🎯"
    var createdAt: Date = .now

    var progress: Double {
        guard targetAmount > 0 else { return 0 }
        return min(savedAmount / targetAmount, 1)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, targetAmount, savedAmount, currency, dueDate, emoji, createdAt
    }

    init(id: UUID = UUID(), title: String, targetAmount: Double, savedAmount: Double, currency: CurrencyCode, dueDate: Date? = nil, emoji: String = "🎯", createdAt: Date = .now) {
        self.id = id
        self.title = title
        self.targetAmount = targetAmount
        self.savedAmount = savedAmount
        self.currency = currency
        self.dueDate = dueDate
        self.emoji = emoji
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        title = try c.decode(String.self, forKey: .title)
        targetAmount = try c.decode(Double.self, forKey: .targetAmount)
        savedAmount = try c.decode(Double.self, forKey: .savedAmount)
        currency = try c.decode(CurrencyCode.self, forKey: .currency)
        dueDate = try c.decodeIfPresent(Date.self, forKey: .dueDate)
        emoji = try c.decodeIfPresent(String.self, forKey: .emoji) ?? "🎯"
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
    }
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
    var color: String = "7C3AED"
    var period: SubscriptionPeriod
    var nextDate: Date
    var createdAt: Date = .now
    var isActive: Bool = true

    private enum CodingKeys: String, CodingKey {
        case id, name, amount, currency, category, icon, color, period, nextDate, createdAt, isActive
    }

    init(id: UUID = UUID(), name: String, amount: Double, currency: CurrencyCode, category: String, icon: String, color: String = "7C3AED", period: SubscriptionPeriod, nextDate: Date, createdAt: Date = .now, isActive: Bool = true) {
        self.id = id
        self.name = name
        self.amount = amount
        self.currency = currency
        self.category = category
        self.icon = icon
        self.color = color
        self.period = period
        self.nextDate = nextDate
        self.createdAt = createdAt
        self.isActive = isActive
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try c.decode(String.self, forKey: .name)
        amount = try c.decode(Double.self, forKey: .amount)
        currency = try c.decode(CurrencyCode.self, forKey: .currency)
        category = try c.decode(String.self, forKey: .category)
        icon = try c.decode(String.self, forKey: .icon)
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "7C3AED"
        period = try c.decode(SubscriptionPeriod.self, forKey: .period)
        nextDate = try c.decode(Date.self, forKey: .nextDate)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
    }
}

struct JointCheckParticipant: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var share: Double
}

struct JointCheckPayment: Identifiable, Codable, Hashable {
    var id = UUID()
    var participantId: UUID
    var amount: Double
    var paidAt: Date = .now
}

struct JointCheck: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var totalAmount: Double
    var currency: CurrencyCode
    var participants: [JointCheckParticipant]
    var payments: [JointCheckPayment] = []
    var isClosed: Bool = false
    var createdAt: Date = .now

    var totalPaid: Double {
        payments.reduce(0) { $0 + $1.amount }
    }

    var remainingAmount: Double {
        max(totalAmount - totalPaid, 0)
    }

    var progress: Double {
        guard totalAmount > 0 else { return 0 }
        return min(totalPaid / totalAmount, 1)
    }
}

struct ReceiptShare: Identifiable, Codable, Hashable {
    var id: String
    var receiptId: UUID
    var ownerId: String
    var ownerName: String
    var privacy: ReceiptPrivacy
    var isActive: Bool = true
    var createdAt: Date = .now
}

struct OnboardingData: Codable, Hashable {
    var gender: Gender?
    var age: Int?
    var isMarried: Bool?
    var hasPets: Bool?
    var completedAt: Date?

    var isComplete: Bool {
        completedAt != nil
    }
}

struct HistorySection: Identifiable, Hashable {
    let title: String
    let items: [TransactionItem]

    var id: String { title }
}

struct UserSettings: Codable, Hashable {
    var mainCurrency: CurrencyCode = .eur
    var walletNames: [String: String] = [
        "EUR": "Євро",
        "USD": "Долари",
        "UAH": "Гривні"
    ]
    var enabledCurrencies: [CurrencyCode] = [.eur, .usd, .uah]
    var budgetLimit: Double = 1200
    var budgetPeriod: BudgetPeriod = .month
    var budgetLimitIncludePrior: Bool = true
    var budgetLimitStartDate: Date?
    var onboardingCompleted: Bool = false
    var theme: String = "dark"
    var smartGoals: [SmartGoal] = []
    var debts: [DebtItem] = []
    var subscriptions: [SubscriptionItem] = []
    var jointChecks: [JointCheck] = []
    var hiddenCategoryIds: [String] = []
    var customCategories: [Category] = []
    var onboarding: OnboardingData = .init()

    private enum CodingKeys: String, CodingKey {
        case mainCurrency
        case walletNames
        case enabledCurrencies
        case budgetLimit
        case budgetPeriod
        case budgetLimitIncludePrior
        case budgetLimitStartDate
        case onboardingCompleted
        case theme
        case smartGoals
        case debts
        case subscriptions
        case jointChecks
        case hiddenCategoryIds
        case customCategories
        case onboarding
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        mainCurrency = try container.decodeIfPresent(CurrencyCode.self, forKey: .mainCurrency) ?? .eur
        walletNames = try container.decodeIfPresent([String: String].self, forKey: .walletNames) ?? [
            "EUR": "Євро",
            "USD": "Долари",
            "UAH": "Гривні"
        ]
        enabledCurrencies = try container.decodeIfPresent([CurrencyCode].self, forKey: .enabledCurrencies) ?? [.eur, .usd, .uah]
        budgetLimit = try container.decodeIfPresent(Double.self, forKey: .budgetLimit) ?? 1200
        budgetPeriod = try container.decodeIfPresent(BudgetPeriod.self, forKey: .budgetPeriod) ?? .month
        budgetLimitIncludePrior = try container.decodeIfPresent(Bool.self, forKey: .budgetLimitIncludePrior) ?? true
        budgetLimitStartDate = try container.decodeIfPresent(Date.self, forKey: .budgetLimitStartDate)
        onboardingCompleted = try container.decodeIfPresent(Bool.self, forKey: .onboardingCompleted) ?? true
        theme = try container.decodeIfPresent(String.self, forKey: .theme) ?? "dark"
        smartGoals = try container.decodeIfPresent([SmartGoal].self, forKey: .smartGoals) ?? []
        debts = try container.decodeIfPresent([DebtItem].self, forKey: .debts) ?? []
        subscriptions = try container.decodeIfPresent([SubscriptionItem].self, forKey: .subscriptions) ?? []
        jointChecks = try container.decodeIfPresent([JointCheck].self, forKey: .jointChecks) ?? []
        hiddenCategoryIds = try container.decodeIfPresent([String].self, forKey: .hiddenCategoryIds) ?? []
        customCategories = try container.decodeIfPresent([Category].self, forKey: .customCategories) ?? []
        onboarding = try container.decodeIfPresent(OnboardingData.self, forKey: .onboarding) ?? .init()
    }
}

struct Category: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let symbol: String
    let colorHex: UInt

    var color: Color { Color(hex: colorHex) }

    private enum CodingKeys: String, CodingKey {
        case id, title, symbol, colorHex
    }
}

let defaultExpenseCategories: [Category] = [
    .init(id: "food", title: "Їжа", symbol: "fork.knife", colorHex: 0x10B981),
    .init(id: "cafe", title: "Кафе", symbol: "cup.and.saucer.fill", colorHex: 0x06B6D4),
    .init(id: "transport", title: "Транспорт", symbol: "car.fill", colorHex: 0xF97316),
    .init(id: "home", title: "Дім", symbol: "house.fill", colorHex: 0x4F46E5),
    .init(id: "subscriptions", title: "Підписки", symbol: "play.rectangle.fill", colorHex: 0x7C3AED),
    .init(id: "shopping", title: "Покупки", symbol: "bag.fill", colorHex: 0xEC4899),
    .init(id: "health", title: "Здоров'я", symbol: "cross.case.fill", colorHex: 0xEF4444),
    .init(id: "entertainment", title: "Розваги", symbol: "gamecontroller.fill", colorHex: 0x14B8A6),
    .init(id: "education", title: "Освіта", symbol: "book.fill", colorHex: 0x0EA5E9),
    .init(id: "gifts", title: "Подарунки", symbol: "gift.fill", colorHex: 0xD946EF),
    .init(id: "other", title: "Інше", symbol: "sparkles", colorHex: 0x64748B)
]

let incomeCategory = Category(id: "income", title: "Дохід", symbol: "arrow.down.left.circle.fill", colorHex: 0x10B981)

func categoryById(_ id: String, customCategories: [Category] = []) -> Category {
    if id == "income" { return incomeCategory }
    if let custom = customCategories.first(where: { $0.id == id }) {
        return custom
    }
    return defaultExpenseCategories.first(where: { $0.id == id })
        ?? defaultExpenseCategories.last!
}

let categoryKeywordSuggestions: [String: [String]] = [
    "food": ["market", "grocery", "silpo", "atb", "novus", "food", "магазин", "продукти", "сільпо"],
    "cafe": ["coffee", "cafe", "starbucks", "restaurant", "pizza", "bar", "кафе", "ресторан", "піца"],
    "transport": ["uber", "bolt", "taxi", "metro", "bus", "fuel", "wog", "okko", "таксі", "метро"],
    "home": ["rent", "internet", "water", "gas", "utility", "оренда", "комуналка", "інтернет"],
    "health": ["pharmacy", "doctor", "clinic", "health", "аптека", "лікар", "клініка"],
    "entertainment": ["cinema", "netflix", "spotify", "steam", "playstation", "кіно"],
    "shopping": ["shop", "store", "amazon", "rozetka", "mall", "магазин", "торговий"],
    "subscriptions": ["subscription", "icloud", "youtube", "chatgpt", "підписка"],
    "education": ["course", "udemy", "book", "courseware", "курс", "книга"],
    "gifts": ["gift", "present", "подарунок"]
]
