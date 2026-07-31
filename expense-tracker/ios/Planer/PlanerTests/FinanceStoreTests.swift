import XCTest
@testable import Planer

@MainActor
final class FinanceStoreTests: XCTestCase {
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
}
