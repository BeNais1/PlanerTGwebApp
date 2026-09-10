import ActivityKit
import Foundation

struct DailyFinanceActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var expenses: Double
        var income: Double
        var currencySymbol: String
        var updatedAt: Date
    }

    var day: Date
}

