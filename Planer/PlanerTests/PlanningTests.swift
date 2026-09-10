import XCTest
@testable import Planer

@MainActor
final class PlanningTests: XCTestCase {
    func makeStore() -> FinanceStore {
        var snapshot = PlanerSnapshot.empty
        snapshot.wallets = [Wallet(name: "Основна", currency: .UAH, balance: 1_000, palette: .graphite), Wallet(name: "Резерв", currency: .USD, balance: 10, palette: .blue)]
        return FinanceStore(snapshot: snapshot, loadPersisted: false, persistsChanges: false)
    }
    func testReconciliationIsReversibleAndExcludedFromAnalytics() throws {
        let store = makeStore()
        let id = store.wallets[0].id
        XCTAssertTrue(store.reconcile(walletID: id, actualBalance: 730))
        XCTAssertEqual(store.wallets[0].balance, 730)
        XCTAssertEqual(store.monthlyExpenses, 0)
        XCTAssertEqual(store.todayExpenses, 0)
        XCTAssertTrue(store.categoryTotals(for: store.transactions).isEmpty)
        let adjustment = try XCTUnwrap(store.transactions.last)
        store.deleteTransaction(adjustment)
        store.deleteTransaction(adjustment)
        XCTAssertEqual(store.wallets[0].balance, 1_000)
        XCTAssertFalse(store.reconcile(walletID: id, actualBalance: .infinity))
    }
    func testPaydayTagsRoundTripAndOldSnapshot() throws {
        let store = makeStore()
        store.setPayday(PaydaySettings(date: .now.addingTimeInterval(864000), reserve: 100, walletIDs: [store.wallets[0].id]))
        store.addTransaction(kind: .expense, amount: 20, walletID: store.wallets[0].id, category: .food, note: "Хліб", tags: ["#Їжа", "їжа", "Місто"])
        let data = try JSONEncoder().encode(store.snapshot)
        let decoded = try JSONDecoder().decode(PlanerSnapshot.self, from: data)
        XCTAssertEqual(decoded.transactions.last?.tags, ["їжа", "місто"])
        XCTAssertEqual(decoded.payday?.reserve, 100)
        XCTAssertEqual(store.paydayAvailable(try XCTUnwrap(decoded.payday)), 880)
        let empty = try JSONDecoder().decode(PlanerSnapshot.self, from: Data("{}".utf8))
        XCTAssertNil(empty.payday)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        var rows = try XCTUnwrap(json["transactions"] as? [[String: Any]])
        rows[0].removeValue(forKey: "tags")
        rows[0].removeValue(forKey: "isReconciliation")
        json["transactions"] = rows
        let old = try JSONDecoder().decode(PlanerSnapshot.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertNil(old.transactions[0].tags)
        XCTAssertNil(old.transactions[0].isReconciliation)
    }
    func testPermissionsAndSelectiveWalletDeletion() {
        let store = makeStore()
        let id = store.wallets[0].id
        store.addTransaction(kind: .expense, amount: 50, walletID: id, category: .food, note: "Їжа")
        store.setAllowsEditing(false)
        store.deleteWallet(id: id)
        XCTAssertFalse(store.reconcile(walletID: id, actualBalance: 0))
        XCTAssertEqual(store.wallets.count, 2)
        store.setAllowsEditing(true)
        store.deleteWallet(id: id)
        XCTAssertEqual(store.wallets.count, 1)
        XCTAssertEqual(store.wallets[0].balance, 10)
        XCTAssertEqual(store.transactions.count, 1)
    }
    func testReceiptTotalExcludesTaxChangeAndUnlabelledPrices() {
        let draft = ReceiptParser.parse("СІЛЬПО\n10.09.2026\nХліб 25,50\nРАЗОМ 125,50 грн\nПДВ 20,00\nРешта 74,50")
        XCTAssertEqual(draft.amount, 125.5)
        XCTAssertEqual(draft.currency, .UAH)
        XCTAssertEqual(draft.merchant, "СІЛЬПО")
        XCTAssertNotNil(draft.date)
        XCTAssertNil(ReceiptParser.parse("Хліб 25,50\nТелефон 380501234567").amount)
        XCTAssertEqual(ReceiptParser.parse("TOTAL\n1 240.50 EUR").amount, 1240.5)
    }
    func testCalendarDaysRespectMidnight() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let today = Date(timeIntervalSince1970: 0)
        XCTAssertEqual(Planning.days(until: today.addingTimeInterval(86400), now: today.addingTimeInterval(86300), calendar: calendar), 1)
        XCTAssertEqual(Planning.days(until: today, now: today.addingTimeInterval(86400), calendar: calendar), 0)
    }
}
