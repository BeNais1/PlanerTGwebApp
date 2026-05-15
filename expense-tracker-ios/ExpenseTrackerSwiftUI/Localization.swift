import Foundation

enum AppLocale {
    static let identifier = "uk_UA"
    static let locale = Locale(identifier: identifier)

    static var monthYearFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "LLLL yyyy"
        return f
    }

    static var weekdayShortFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "EEE"
        return f
    }

    static var mediumDateFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = locale
        f.dateStyle = .medium
        return f
    }

    static var dayMonthFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = locale
        f.setLocalizedDateFormatFromTemplate("d MMMM")
        return f
    }

    static var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = locale
        f.timeStyle = .short
        return f
    }

    static func relativeDay(for date: Date, now: Date = .init()) -> String {
        let cal = Calendar(identifier: .gregorian)
        if cal.isDateInToday(date) { return "Сьогодні" }
        if cal.isDateInYesterday(date) { return "Вчора" }
        return dayMonthFormatter.string(from: date)
    }
}
