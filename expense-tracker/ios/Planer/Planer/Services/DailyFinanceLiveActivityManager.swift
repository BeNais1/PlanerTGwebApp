import ActivityKit
import Foundation

struct DailyFinanceSnapshot: Hashable {
    let expenses: Double
    let income: Double
    let currencySymbol: String
}

@MainActor
final class DailyFinanceLiveActivityManager {
    static let shared = DailyFinanceLiveActivityManager()

    private init() {}

    func refresh(with snapshot: DailyFinanceSnapshot) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let now = Date.now
        let state = DailyFinanceActivityAttributes.ContentState(
            expenses: snapshot.expenses,
            income: snapshot.income,
            currencySymbol: snapshot.currencySymbol,
            updatedAt: now
        )
        let content = ActivityContent(
            state: state,
            staleDate: Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)),
            relevanceScore: 1
        )

        let activities = Activity<DailyFinanceActivityAttributes>.activities
        if let current = activities.first(where: { Calendar.current.isDateInToday($0.attributes.day) }) {
            await current.update(content)
            for obsolete in activities where obsolete.id != current.id {
                await obsolete.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        for obsolete in activities {
            await obsolete.end(nil, dismissalPolicy: .immediate)
        }

        do {
            _ = try Activity.request(
                attributes: DailyFinanceActivityAttributes(day: Calendar.current.startOfDay(for: now)),
                content: content,
                pushType: nil
            )
        } catch {
            print("Live Activity could not start: \(error)")
        }
    }
}

