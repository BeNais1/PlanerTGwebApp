import Foundation

enum Currency: String, Codable, CaseIterable, Identifiable, Hashable {
    case UAH
    case USD
    case EUR

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .UAH: "₴"
        case .USD: "$"
        case .EUR: "€"
        }
    }

    var title: String {
        switch self {
        case .UAH: "Українська гривня"
        case .USD: "Долар США"
        case .EUR: "Євро"
        }
    }

    func formatted(_ amount: Double, showCode: Bool = false) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = rawValue
        formatter.currencySymbol = showCode ? rawValue : symbol
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "uk_UA")
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount) \(symbol)"
    }
}

enum WalletPalette: String, Codable, CaseIterable, Hashable {
    case violet
    case blue
    case graphite
    case emerald
}

struct Wallet: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var currency: Currency
    var balance: Double
    var palette: WalletPalette
    var createdAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        currency: Currency,
        balance: Double,
        palette: WalletPalette,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.currency = currency
        self.balance = balance
        self.palette = palette
        self.createdAt = createdAt
    }
}

enum FinanceTransactionKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case expense
    case income
    case transfer

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: "Витрата"
        case .income: "Дохід"
        case .transfer: "Переказ"
        }
    }

    var systemImage: String {
        switch self {
        case .expense: "arrow.up.right"
        case .income: "arrow.down.left"
        case .transfer: "arrow.left.arrow.right"
        }
    }
}

enum TransactionCategory: String, Codable, CaseIterable, Identifiable, Hashable {
    case food
    case transport
    case home
    case health
    case shopping
    case entertainment
    case salary
    case transfer
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .food: "Їжа"
        case .transport: "Транспорт"
        case .home: "Дім"
        case .health: "Здоров’я"
        case .shopping: "Покупки"
        case .entertainment: "Розваги"
        case .salary: "Зарплата"
        case .transfer: "Переказ"
        case .other: "Інше"
        }
    }

    var systemImage: String {
        switch self {
        case .food: "fork.knife"
        case .transport: "car.fill"
        case .home: "house.fill"
        case .health: "cross.case.fill"
        case .shopping: "bag.fill"
        case .entertainment: "sparkles.tv.fill"
        case .salary: "banknote.fill"
        case .transfer: "arrow.left.arrow.right"
        case .other: "ellipsis"
        }
    }
}

struct FinanceTransaction: Identifiable, Codable, Hashable {
    let id: UUID
    var kind: FinanceTransactionKind
    var amount: Double
    var currency: Currency
    var category: TransactionCategory
    var note: String
    var date: Date
    var walletID: UUID
    var destinationWalletID: UUID?
    var convertedAmount: Double?
    var authorName: String?

    init(
        id: UUID = UUID(),
        kind: FinanceTransactionKind,
        amount: Double,
        currency: Currency,
        category: TransactionCategory,
        note: String,
        date: Date = .now,
        walletID: UUID,
        destinationWalletID: UUID? = nil,
        convertedAmount: Double? = nil,
        authorName: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.amount = amount
        self.currency = currency
        self.category = category
        self.note = note
        self.date = date
        self.walletID = walletID
        self.destinationWalletID = destinationWalletID
        self.convertedAmount = convertedAmount
        self.authorName = authorName
    }
}

struct SavingsGoal: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var targetAmount: Double
    var savedAmount: Double
    var currency: Currency
    var dueDate: Date?

    init(
        id: UUID = UUID(),
        title: String,
        targetAmount: Double,
        savedAmount: Double = 0,
        currency: Currency,
        dueDate: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.targetAmount = targetAmount
        self.savedAmount = savedAmount
        self.currency = currency
        self.dueDate = dueDate
    }
}

enum DebtDirection: String, Codable, CaseIterable, Identifiable, Hashable {
    case owedToMe
    case iOwe

    var id: String { rawValue }
    var title: String { self == .owedToMe ? "Мені винні" : "Я винен" }
}

struct DebtItem: Identifiable, Codable, Hashable {
    let id: UUID
    var person: String
    var amount: Double
    var currency: Currency
    var direction: DebtDirection
    var dueDate: Date?
    var isPaid: Bool

    init(
        id: UUID = UUID(),
        person: String,
        amount: Double,
        currency: Currency,
        direction: DebtDirection,
        dueDate: Date? = nil,
        isPaid: Bool = false
    ) {
        self.id = id
        self.person = person
        self.amount = amount
        self.currency = currency
        self.direction = direction
        self.dueDate = dueDate
        self.isPaid = isPaid
    }
}

struct ReceiptSummary: Identifiable, Codable, Hashable {
    let id: UUID
    var merchant: String
    var amount: Double
    var currency: Currency
    var date: Date
    var isShared: Bool
}

struct CategoryTotal: Identifiable, Hashable {
    var id: TransactionCategory { category }
    let category: TransactionCategory
    let amount: Double
}

struct PlanerSnapshot: Codable {
    var wallets: [Wallet]
    var transactions: [FinanceTransaction]
    var goals: [SavingsGoal]
    var debts: [DebtItem]
    var receipts: [ReceiptSummary]
    var budgetLimit: Double
    var mainCurrency: Currency
    var prefersDarkAppearance: Bool
    var activeSpaceName: String

    private enum CodingKeys: String, CodingKey {
        case wallets
        case transactions
        case goals
        case debts
        case receipts
        case budgetLimit
        case mainCurrency
        case prefersDarkAppearance
        case activeSpaceName
    }

    init(
        wallets: [Wallet],
        transactions: [FinanceTransaction],
        goals: [SavingsGoal],
        debts: [DebtItem],
        receipts: [ReceiptSummary],
        budgetLimit: Double,
        mainCurrency: Currency,
        prefersDarkAppearance: Bool,
        activeSpaceName: String
    ) {
        self.wallets = wallets
        self.transactions = transactions
        self.goals = goals
        self.debts = debts
        self.receipts = receipts
        self.budgetLimit = budgetLimit
        self.mainCurrency = mainCurrency
        self.prefersDarkAppearance = prefersDarkAppearance
        self.activeSpaceName = activeSpaceName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Realtime Database does not preserve empty arrays. Defaults keep an
        // empty or older cloud snapshot decodable instead of breaking sync.
        wallets = try container.decodeIfPresent([Wallet].self, forKey: .wallets) ?? []
        transactions = try container.decodeIfPresent([FinanceTransaction].self, forKey: .transactions) ?? []
        goals = try container.decodeIfPresent([SavingsGoal].self, forKey: .goals) ?? []
        debts = try container.decodeIfPresent([DebtItem].self, forKey: .debts) ?? []
        receipts = try container.decodeIfPresent([ReceiptSummary].self, forKey: .receipts) ?? []
        budgetLimit = try container.decodeIfPresent(Double.self, forKey: .budgetLimit) ?? 0
        mainCurrency = try container.decodeIfPresent(Currency.self, forKey: .mainCurrency) ?? .UAH
        prefersDarkAppearance = try container.decodeIfPresent(Bool.self, forKey: .prefersDarkAppearance) ?? false
        activeSpaceName = try container.decodeIfPresent(String.self, forKey: .activeSpaceName) ?? "Особистий бюджет"
    }

    static let empty = PlanerSnapshot(
        wallets: [],
        transactions: [],
        goals: [],
        debts: [],
        receipts: [],
        budgetLimit: 0,
        mainCurrency: .UAH,
        prefersDarkAppearance: true,
        activeSpaceName: "Особистий бюджет"
    )
}
