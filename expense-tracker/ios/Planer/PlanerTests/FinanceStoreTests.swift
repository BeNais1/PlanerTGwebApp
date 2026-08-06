import XCTest
@testable import Planer

@MainActor
final class FinanceStoreTests: XCTestCase {
    func testFamilyInviteLinkParsesAppURLAndRawCode() {
        XCTAssertEqual(
            FamilyInviteLink.code(from: "planer://family/join/PLANER2026"),
            "PLANER2026"
        )
        XCTAssertEqual(FamilyInviteLink.code(from: "PLANER2026"), "PLANER2026")
        XCTAssertNil(FamilyInviteLink.code(from: "planer://receipt/PLANER2026"))
        XCTAssertNil(FamilyInviteLink.code(from: "short"))
    }

    func testFinanceSpaceUsesIndependentCacheNamespaces() {
        let personal = FinanceSpace.personal(userID: "user-1")
        let family = FinanceSpace.family(id: "family-1", name: "Родина")

        XCTAssertEqual(personal.cacheNamespace, "user-1")
        XCTAssertEqual(family.cacheNamespace, "family.family-1")
        XCTAssertNotEqual(personal.cacheNamespace, family.cacheNamespace)
        XCTAssertEqual(family.title, "Родина")
    }

    func testFreshStoreStartsEmpty() {
        let store = FinanceStore(
            storageNamespace: UUID().uuidString,
            loadPersisted: false,
            persistsChanges: false
        )

        XCTAssertTrue(store.wallets.isEmpty)
        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertTrue(store.goals.isEmpty)
        XCTAssertTrue(store.debts.isEmpty)
        XCTAssertTrue(store.receipts.isEmpty)
        XCTAssertEqual(store.budgetLimit, 0)
    }

    func testExpenseUpdatesBalanceAndCanBeReversed() throws {
        let wallet = Wallet(name: "Test", currency: .UAH, balance: 1_000, palette: .blue)
        let store = FinanceStore(
            snapshot: PlanerSnapshot(
                wallets: [wallet],
                transactions: [],
                goals: [],
                debts: [],
                receipts: [],
                budgetLimit: 0,
                mainCurrency: .UAH,
                prefersDarkAppearance: true,
                activeSpaceName: "Test"
            ),
            loadPersisted: false,
            persistsChanges: false
        )

        store.addTransaction(kind: .expense, amount: 125, walletID: wallet.id, category: .food, note: "Lunch")

        XCTAssertEqual(try XCTUnwrap(store.wallets.first?.balance), 875, accuracy: 0.001)
        let transaction = try XCTUnwrap(store.transactions.first)

        store.deleteTransaction(transaction)

        XCTAssertEqual(try XCTUnwrap(store.wallets.first?.balance), 1_000, accuracy: 0.001)
        XCTAssertTrue(store.transactions.isEmpty)
    }

    func testTransferUsesDestinationCurrency() throws {
        let source = Wallet(name: "UAH", currency: .UAH, balance: 10_000, palette: .violet)
        let destination = Wallet(name: "USD", currency: .USD, balance: 100, palette: .graphite)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [source, destination]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        store.addTransaction(
            kind: .transfer,
            amount: 4_120,
            walletID: source.id,
            destinationWalletID: destination.id,
            category: .transfer,
            note: "Reserve"
        )

        XCTAssertEqual(try XCTUnwrap(store.wallet(id: source.id)?.balance), 5_880, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(store.wallet(id: destination.id)?.balance), 200, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(store.transactions.first?.convertedAmount), 100, accuracy: 0.001)
    }

    func testBudgetProgressIsCappedAtOne() {
        let wallet = Wallet(name: "Main", currency: .UAH, balance: 20_000, palette: .emerald)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.budgetLimit = 100
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        store.addTransaction(kind: .expense, amount: 150, walletID: wallet.id, category: .shopping, note: "Test")

        XCTAssertEqual(store.budgetProgress, 1, accuracy: 0.001)
    }

    func testClearAllDataProducesEmptySnapshot() {
        let wallet = Wallet(name: "Main", currency: .UAH, balance: 500, palette: .blue)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        store.clearAllData()

        XCTAssertTrue(store.wallets.isEmpty)
        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertEqual(store.budgetLimit, 0)
    }

    func testSnapshotDecodesWhenRealtimeDatabaseOmitsEmptyCollections() throws {
        let data = Data(#"{"mainCurrency":"UAH","activeSpaceName":"Особистий бюджет"}"#.utf8)

        let snapshot = try JSONDecoder().decode(PlanerSnapshot.self, from: data)

        XCTAssertTrue(snapshot.wallets.isEmpty)
        XCTAssertTrue(snapshot.transactions.isEmpty)
        XCTAssertTrue(snapshot.goals.isEmpty)
        XCTAssertTrue(snapshot.debts.isEmpty)
        XCTAssertTrue(snapshot.receipts.isEmpty)
        XCTAssertEqual(snapshot.budgetLimit, 0)
        XCTAssertFalse(snapshot.prefersDarkAppearance)
    }

    func testGoalFundingCanDebitSelectedWallet() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let goal = SavingsGoal(title: "Ноутбук", targetAmount: 2_000, currency: .UAH)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.goals = [goal]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        XCTAssertTrue(store.topUpGoal(id: goal.id, amount: 250, sourceWalletID: wallet.id))

        XCTAssertEqual(try XCTUnwrap(store.goals.first?.savedAmount), 250, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(store.wallet(id: wallet.id)?.balance), 750, accuracy: 0.001)
    }

    func testGoalFundingCanLeaveWalletBalancesUntouched() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let goal = SavingsGoal(title: "Подорож", targetAmount: 2_000, currency: .UAH)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.goals = [goal]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        XCTAssertTrue(store.topUpGoal(id: goal.id, amount: 250))

        XCTAssertEqual(try XCTUnwrap(store.goals.first?.savedAmount), 250, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(store.wallet(id: wallet.id)?.balance), 1_000, accuracy: 0.001)
    }

    func testSettlingIncomingDebtCanCreditWallet() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let debt = DebtItem(person: "Олексій", amount: 100, currency: .UAH, direction: .owedToMe)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.debts = [debt]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        XCTAssertTrue(store.settleDebt(id: debt.id, walletID: wallet.id))

        XCTAssertEqual(try XCTUnwrap(store.wallet(id: wallet.id)?.balance), 1_100, accuracy: 0.001)
        XCTAssertTrue(try XCTUnwrap(store.debts.first?.isPaid))
        let transaction = try XCTUnwrap(store.transactions.first)
        XCTAssertEqual(transaction.kind, .income)
        XCTAssertEqual(transaction.amount, 100, accuracy: 0.001)
        XCTAssertEqual(transaction.sourceDebtID, debt.id)
        XCTAssertTrue(transaction.note.contains("Олексій"))
    }

    func testSettlingOutgoingDebtCanDebitWallet() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let debt = DebtItem(person: "Марія", amount: 100, currency: .UAH, direction: .iOwe)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.debts = [debt]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        XCTAssertTrue(store.settleDebt(id: debt.id, walletID: wallet.id))

        XCTAssertEqual(try XCTUnwrap(store.wallet(id: wallet.id)?.balance), 900, accuracy: 0.001)
        XCTAssertTrue(try XCTUnwrap(store.debts.first?.isPaid))
        XCTAssertEqual(try XCTUnwrap(store.transactions.first?.kind), .expense)
    }

    func testReceiptCanBeCreatedOnlyOnceForTransaction() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let transaction = FinanceTransaction(
            kind: .expense,
            amount: 250,
            currency: .UAH,
            category: .food,
            note: "Кав’ярня",
            walletID: wallet.id
        )
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.transactions = [transaction]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        let receipt = try XCTUnwrap(store.createReceipt(for: transaction, merchant: "Кав’ярня на Подолі"))

        XCTAssertEqual(receipt.transactionID, transaction.id)
        XCTAssertEqual(receipt.merchant, "Кав’ярня на Подолі")
        XCTAssertEqual(receipt.amount, transaction.amount, accuracy: 0.001)
        XCTAssertNil(store.createReceipt(for: transaction, merchant: "Дублікат"))
        XCTAssertEqual(store.receipts.count, 1)
    }

    func testCustomCategoryCanBeUsedAndPersistedInSnapshot() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        let category = try XCTUnwrap(
            store.addCustomCategory(
                title: "Кіт",
                systemImage: "pawprint.fill",
                colorHex: "FF7A38",
                kind: .expense
            )
        )
        store.addTransaction(
            kind: .expense,
            amount: 50,
            walletID: wallet.id,
            category: .other,
            customCategoryID: category.id,
            note: "Корм"
        )

        let transaction = try XCTUnwrap(store.transactions.first)
        XCTAssertEqual(transaction.customCategoryID, category.id)
        XCTAssertEqual(store.categoryPresentation(for: transaction).title, "Кіт")
        XCTAssertEqual(store.snapshot.customCategories, [category])
        XCTAssertEqual(try XCTUnwrap(store.categoryTotals(for: [transaction]).first?.title), "Кіт")
    }

    func testReceiptKeepsDigitalReceiptMetadata() throws {
        let wallet = Wallet(name: "Mono", currency: .UAH, balance: 1_000, palette: .blue)
        let transaction = FinanceTransaction(
            kind: .expense,
            amount: 125,
            currency: .UAH,
            category: .food,
            note: "Обід",
            walletID: wallet.id
        )
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.transactions = [transaction]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        let receipt = try XCTUnwrap(
            store.createReceipt(for: transaction, merchant: "Кафе", authorName: "Борис")
        )

        XCTAssertEqual(receipt.authorName, "Борис")
        XCTAssertEqual(receipt.walletName, "Mono")
        XCTAssertEqual(receipt.categoryTitle, "Їжа")
        XCTAssertEqual(receipt.transactionKind, .expense)
        XCTAssertNotNil(receipt.createdAt)
    }

    func testTransactionPreservesSelectedDateAndTime() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)
        let selectedDate = try XCTUnwrap(
            Calendar(identifier: .gregorian).date(
                from: DateComponents(year: 2026, month: 8, day: 4, hour: 18, minute: 37)
            )
        )

        store.addTransaction(
            kind: .expense,
            amount: 100,
            walletID: wallet.id,
            category: .transport,
            note: "Таксі",
            date: selectedDate
        )

        XCTAssertEqual(try XCTUnwrap(store.transactions.first?.date), selectedDate)
    }

    func testSharedReceiptCanBeSavedOnlyOnceAndDeletedWithoutTransaction() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let transaction = FinanceTransaction(
            kind: .expense,
            amount: 90,
            currency: .UAH,
            category: .food,
            note: "Кава",
            walletID: wallet.id
        )
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.transactions = [transaction]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)
        let incoming = ReceiptSummary(
            merchant: "Кав’ярня",
            amount: 90,
            currency: .UAH,
            date: .now,
            isShared: true,
            transactionID: UUID(),
            categoryTitle: "Їжа",
            shareCode: "ABCDEFGH"
        )

        let saved = store.saveSharedReceipt(incoming)
        _ = store.saveSharedReceipt(incoming)

        XCTAssertEqual(store.receipts.count, 1)
        XCTAssertNil(saved.transactionID)
        store.deleteReceipt(id: saved.id)
        XCTAssertTrue(store.receipts.isEmpty)
        XCTAssertEqual(store.transactions, [transaction])
    }

    func testTodayTotalsUseMainCurrencyAndIgnoreOlderTransactions() throws {
        let wallet = Wallet(name: "Основний", currency: .UAH, balance: 1_000, palette: .blue)
        let yesterday = try XCTUnwrap(Calendar.current.date(byAdding: .day, value: -1, to: .now))
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.transactions = [
            FinanceTransaction(kind: .expense, amount: 125, currency: .UAH, category: .food, note: "", date: .now, walletID: wallet.id),
            FinanceTransaction(kind: .income, amount: 400, currency: .UAH, category: .salary, note: "", date: .now, walletID: wallet.id),
            FinanceTransaction(kind: .expense, amount: 999, currency: .UAH, category: .other, note: "", date: yesterday, walletID: wallet.id)
        ]
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)

        XCTAssertEqual(store.todayExpenses, 125, accuracy: 0.001)
        XCTAssertEqual(store.todayIncome, 400, accuracy: 0.001)
    }

    func testReadOnlyFamilyMemberCannotMutateBudget() {
        let wallet = Wallet(name: "Сімейна картка", currency: .UAH, balance: 1_000, palette: .blue)
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [wallet]
        snapshot.budgetLimit = 5_000
        let store = FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)
        store.setAllowsEditing(false)

        store.addTransaction(
            kind: .expense,
            amount: 250,
            walletID: wallet.id,
            category: .food,
            note: "Продукти"
        )
        store.addWallet(name: "Нова картка", currency: .UAH, balance: 100)
        store.setBudgetLimit(1_000)
        store.clearAllData()

        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertEqual(store.wallets, [wallet])
        XCTAssertEqual(store.budgetLimit, 5_000)
    }
}
