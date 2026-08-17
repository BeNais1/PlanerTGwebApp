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

    var colorHex: String {
        switch self {
        case .food: "FF7A38"
        case .transport: "2E94FF"
        case .home: "8C5CF5"
        case .health: "FF4F73"
        case .shopping: "ED4FB8"
        case .entertainment: "FAAD1F"
        case .salary: "33C77F"
        case .transfer: "247AFF"
        case .other: "737D91"
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
    var customCategoryID: UUID?
    var sourceDebtID: UUID?

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
        authorName: String? = nil,
        customCategoryID: UUID? = nil,
        sourceDebtID: UUID? = nil
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
        self.customCategoryID = customCategoryID
        self.sourceDebtID = sourceDebtID
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

struct CreditPayment: Identifiable, Codable, Hashable {
    let id: UUID
    var dueDate: Date
    var amount: Double
    var deductFromWallet: Bool
    var isPaid: Bool
    var paidAt: Date?

    init(
        id: UUID = UUID(),
        dueDate: Date,
        amount: Double,
        deductFromWallet: Bool = true,
        isPaid: Bool = false,
        paidAt: Date? = nil
    ) {
        self.id = id
        self.dueDate = dueDate
        self.amount = amount
        self.deductFromWallet = deductFromWallet
        self.isPaid = isPaid
        self.paidAt = paidAt
    }
}

struct CreditAccount: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var lender: String
    var currency: Currency
    var walletID: UUID?
    var payments: [CreditPayment]
    var createdAt: Date

    init(
        id: UUID = UUID(),
        title: String,
        lender: String,
        currency: Currency,
        walletID: UUID?,
        payments: [CreditPayment],
        createdAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.lender = lender
        self.currency = currency
        self.walletID = walletID
        self.payments = payments.sorted { $0.dueDate < $1.dueDate }
        self.createdAt = createdAt
    }

    var remainingAmount: Double {
        payments.filter { !$0.isPaid }.reduce(0) { $0 + $1.amount }
    }
}

struct ReceiptSummary: Identifiable, Codable, Hashable {
    let id: UUID
    var merchant: String
    var amount: Double
    var currency: Currency
    var date: Date
    var isShared: Bool
    var transactionID: UUID?
    var categoryTitle: String?
    var categorySystemImage: String?
    var transactionKind: FinanceTransactionKind?
    var note: String?
    var walletName: String?
    var authorName: String?
    var shareCode: String?
    var createdAt: Date?

    init(
        id: UUID = UUID(),
        merchant: String,
        amount: Double,
        currency: Currency,
        date: Date,
        isShared: Bool = false,
        transactionID: UUID? = nil,
        categoryTitle: String? = nil,
        categorySystemImage: String? = nil,
        transactionKind: FinanceTransactionKind? = nil,
        note: String? = nil,
        walletName: String? = nil,
        authorName: String? = nil,
        shareCode: String? = nil,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.merchant = merchant
        self.amount = amount
        self.currency = currency
        self.date = date
        self.isShared = isShared
        self.transactionID = transactionID
        self.categoryTitle = categoryTitle
        self.categorySystemImage = categorySystemImage
        self.transactionKind = transactionKind
        self.note = note
        self.walletName = walletName
        self.authorName = authorName
        self.shareCode = shareCode
        self.createdAt = createdAt
    }
}

struct CustomTransactionCategory: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var systemImage: String
    var colorHex: String
    var kind: FinanceTransactionKind

    init(
        id: UUID = UUID(),
        title: String,
        systemImage: String,
        colorHex: String,
        kind: FinanceTransactionKind
    ) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.colorHex = colorHex
        self.kind = kind
    }
}

struct TransactionCategoryPresentation: Identifiable, Hashable {
    let id: String
    let title: String
    let systemImage: String
    let colorHex: String
    let builtIn: TransactionCategory?
    let customID: UUID?
}

struct CategoryTotal: Identifiable, Hashable {
    let id: String
    let title: String
    let systemImage: String
    let colorHex: String
    let amount: Double
}

struct PlanerSnapshot: Codable, Equatable {
    var wallets: [Wallet]
    var transactions: [FinanceTransaction]
    var goals: [SavingsGoal]
    var debts: [DebtItem]
    var credits: [CreditAccount]
    var receipts: [ReceiptSummary]
    var customCategories: [CustomTransactionCategory]
    var budgetLimit: Double
    var mainCurrency: Currency
    var prefersDarkAppearance: Bool
    var activeSpaceName: String

    private enum CodingKeys: String, CodingKey {
        case wallets
        case transactions
        case goals
        case debts
        case credits
        case receipts
        case customCategories
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
        credits: [CreditAccount] = [],
        receipts: [ReceiptSummary],
        customCategories: [CustomTransactionCategory] = [],
        budgetLimit: Double,
        mainCurrency: Currency,
        prefersDarkAppearance: Bool,
        activeSpaceName: String
    ) {
        self.wallets = wallets
        self.transactions = transactions
        self.goals = goals
        self.debts = debts
        self.credits = credits
        self.receipts = receipts
        self.customCategories = customCategories
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
        credits = try container.decodeIfPresent([CreditAccount].self, forKey: .credits) ?? []
        receipts = try container.decodeIfPresent([ReceiptSummary].self, forKey: .receipts) ?? []
        customCategories = try container.decodeIfPresent([CustomTransactionCategory].self, forKey: .customCategories) ?? []
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
        credits: [],
        receipts: [],
        customCategories: [],
        budgetLimit: 0,
        mainCurrency: .UAH,
        prefersDarkAppearance: true,
        activeSpaceName: "Особистий бюджет"
    )
}
