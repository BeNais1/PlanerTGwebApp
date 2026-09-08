import ActivityKit
import XCTest
@testable import Planer

@MainActor
final class DailyFinanceLiveActivityTests: XCTestCase {
    private var calendar: Calendar {
        var result = Calendar(identifier: .gregorian)
        result.timeZone = TimeZone(secondsFromGMT: 0)!
        return result
    }

    func testEndedOrDismissedCardCannotBeUpdatedAsActive() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        for state: ActivityState in [.ended, .dismissed] {
            XCTAssertFalse(DailyFinanceLiveActivityManager.canReuse(state: state, day: now, now: now))
        }
    }

    func testStaleCardCanReceiveFreshContent() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        for state: ActivityState in [.active, .stale] {
            XCTAssertTrue(DailyFinanceLiveActivityManager.canReuse(state: state, day: now, now: now))
        }
    }

    func testMidnightRequiresNewDayAttributes() {
        let day = calendar.startOfDay(for: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertTrue(DailyFinanceLiveActivityManager.canReuse(
            state: .active, day: day, now: day.addingTimeInterval(86399), calendar: calendar
        ))
        XCTAssertFalse(DailyFinanceLiveActivityManager.canReuse(
            state: .active, day: day, now: day.addingTimeInterval(86400), calendar: calendar
        ))
    }
}
