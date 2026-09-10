import Foundation

struct PaydaySettings: Codable, Equatable {
    var date: Date
    var reserve: Double
    var walletIDs: [UUID]
}

enum Planning {
    static func tags(_ text: String) -> [String] {
        var seen = Set<String>()
        return text.components(separatedBy: CharacterSet(charactersIn: ",#\n"))
            .map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().prefix(30)) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .prefix(12).map { $0 }
    }

    static func days(until date: Date, now: Date = .now, calendar: Calendar = .current) -> Int {
        max(0, calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: date)).day ?? 0)
    }
}

struct ReceiptDraft: Equatable {
    var merchant: String
    var amount: Double?
    var date: Date?
    var currency: Currency?
    var text: String
}

enum ReceiptParser {
    static func parse(_ text: String) -> ReceiptDraft {
        let lines = text.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        let pattern = #"\d[\d\s\u00a0]*[.,]\d{2}(?!\d)"#
        let regex = try! NSRegularExpression(pattern: pattern)
        var candidates: [(Int, Double)] = []
        for (index, line) in lines.enumerated() {
            let lower = line.lowercased()
            guard !["решта", "сдача", "change", "пдв", "vat", "знижка"].contains(where: lower.contains) else { continue }
            let priority = ["до сплати", "разом", "всього", "итого", "total", "сума"].contains(where: lower.contains) ? 10 : 0
            let source = priority > 0 && !regex.matches(in: line, range: NSRange(line.startIndex..., in: line)).isEmpty ? line : priority > 0 && index + 1 < lines.count ? lines[index + 1] : line
            for match in regex.matches(in: source, range: NSRange(source.startIndex..., in: source)) {
                guard let range = Range(match.range, in: source),
                      let value = Double(source[range].filter { !$0.isWhitespace }.replacingOccurrences(of: ",", with: ".")), value > 0, value.isFinite else { continue }
                candidates.append((priority, value))
            }
        }
        // Only a labelled total is trusted; unlabelled prices stay for manual review.
        let amount = candidates.filter { $0.0 > 0 }.last?.1
        let datePattern = try! NSRegularExpression(pattern: #"\b\d{2}[./-]\d{2}[./-]\d{4}\b"#)
        var date: Date?
        if let match = datePattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)), let range = Range(match.range, in: text) {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "dd.MM.yyyy"
            formatter.isLenient = false
            date = formatter.date(from: String(text[range]).replacingOccurrences(of: "/", with: ".").replacingOccurrences(of: "-", with: "."))
        }
        let upper = text.uppercased()
        let currency: Currency? = upper.contains("ГРН") || upper.contains("UAH") || upper.contains("₴") ? .UAH : upper.contains("EUR") || upper.contains("€") ? .EUR : upper.contains("USD") || upper.contains("$") ? .USD : nil
        return ReceiptDraft(merchant: lines.first ?? "", amount: amount, date: date, currency: currency, text: text)
    }
}
