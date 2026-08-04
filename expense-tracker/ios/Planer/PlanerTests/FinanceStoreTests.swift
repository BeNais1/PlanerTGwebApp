import XCTest
@testable import Planer

@MainActor
final class FinanceStoreTests: XCTestCase {
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
    }
}
