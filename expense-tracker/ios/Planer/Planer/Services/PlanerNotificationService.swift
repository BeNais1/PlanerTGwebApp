import Foundation
import Observation
import UserNotifications

struct PlanerNotificationPreferences: Codable, Hashable {
    var dailyReminder = true
    var budgetAlerts = true
    var upcomingPayments = true
    var debtReminders = true
    var recurringOperations = true
    var goalUpdates = true
    var lowBalanceForecast = true
    var periodicSummaries = true
    var familyUpdates = true
    var showAmounts = true
    var dailyReminderMinutes = 20 * 60

    static let `default` = PlanerNotificationPreferences()
}

@MainActor
@Observable
final class PlanerNotificationService {
    static let shared = PlanerNotificationService()

    static let addExpenseAction = "PLANER_ADD_EXPENSE"
    static let addIncomeAction = "PLANER_ADD_INCOME"
    static let openAction = "PLANER_OPEN"
    static let financeCategory = "PLANER_FINANCE"
    static let familyCategory = "PLANER_FAMILY"

    private static let preferencesKey = "planer.notification.preferences.v1"
    private static let requestPrefix = "planer.notification."

    private let center = UNUserNotificationCenter.current()
    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    private(set) var lastError: String?
    var preferences: PlanerNotificationPreferences {
        didSet { savePreferences() }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.preferencesKey),
           let decoded = try? JSONDecoder().decode(PlanerNotificationPreferences.self, from: data) {
            preferences = decoded
        } else {
            preferences = .default
        }
    }

    static func registerCategories() {
        let expense = UNNotificationAction(
            identifier: addExpenseAction,
            title: "Додати витрату",
            options: [.foreground]
        )
        let income = UNNotificationAction(
            identifier: addIncomeAction,
            title: "Додати дохід",
            options: [.foreground]
        )
        let open = UNNotificationAction(
            identifier: openAction,
            title: "Переглянути",
            options: [.foreground]
        )
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(
                identifier: financeCategory,
                actions: [expense, income],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: familyCategory,
                actions: [open],
                intentIdentifiers: [],
                options: []
            )
        ])
    }

    func refreshAuthorizationStatus() async {
        authorizationStatus = await center.notificationSettings().authorizationStatus
    }

    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            await refreshAuthorizationStatus()
            lastError = nil
            return granted
        } catch {
            lastError = error.localizedDescription
            await refreshAuthorizationStatus()
            return false
        }
    }

    func rescheduleAll(store: FinanceStore, familyName: String?) async {
        await refreshAuthorizationStatus()
        guard authorizationStatus == .authorized || authorizationStatus == .provisional else { return }

        let pending = await center.pendingNotificationRequests()
        let plannerIDs = pending.map(\.identifier).filter { $0.hasPrefix(Self.requestPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: plannerIDs)

        if preferences.dailyReminder {
            await scheduleDailyReminder()
        }
        if preferences.upcomingPayments {
            await scheduleUpcomingPayments(store: store)
        }
        if preferences.debtReminders {
            await scheduleDebtReminders(store: store)
        }
        if preferences.recurringOperations {
            await scheduleRecurringOperations(store: store)
        }
        if preferences.goalUpdates {
            await scheduleGoalDeadlines(store: store)
            await evaluateGoalProgress(store: store)
        }
        if preferences.periodicSummaries {
            await scheduleSummaries(store: store, familyName: familyName)
        }
        if preferences.budgetAlerts {
            await evaluateBudget(store: store)
        }
        if preferences.lowBalanceForecast {
            await evaluateBalanceForecast(store: store)
        }
    }

    func notifyFamilyChanges(
        previous: PlanerSnapshot,
        current: PlanerSnapshot,
        familyName: String,
        currentUserName: String
    ) async {
        guard preferences.familyUpdates else { return }
        await refreshAuthorizationStatus()
        guard authorizationStatus == .authorized || authorizationStatus == .provisional else { return }

        let previousTransactionIDs = Set(previous.transactions.map(\.id))
        let newTransactions = current.transactions
            .filter { !previousTransactionIDs.contains($0.id) }
            .filter { $0.authorName?.localizedCaseInsensitiveCompare(currentUserName) != .orderedSame }
            .sorted { $0.date > $1.date }
            .prefix(3)

        for transaction in newTransactions {
            let author = nonempty(transaction.authorName) ?? "Учасник сім’ї"
            let title = "Нова сімейна операція"
            let amount = preferences.showAmounts ? " · \(transaction.currency.formatted(transaction.amount))" : ""
            let body = "\(author) додав(ла) \(transaction.kind.title.lowercased())\(amount) у «\(familyName)»."
            await deliverFamilyNotification(title: title, body: body, suffix: "transaction.\(transaction.id)")
        }

        let previousReceiptIDs = Set(previous.receipts.map(\.id))
        if let receipt = current.receipts.first(where: { !previousReceiptIDs.contains($0.id) }) {
            await deliverFamilyNotification(
                title: "Новий сімейний чек",
                body: "У «\(familyName)» збережено чек «\(receipt.merchant)».",
                suffix: "receipt.\(receipt.id)"
            )
        }

        for debt in current.debts where debt.isPaid {
            guard previous.debts.first(where: { $0.id == debt.id })?.isPaid == false else { continue }
            await deliverFamilyNotification(
                title: "Сімейний борг закрито",
                body: "Борг із \(debt.person) позначено як погашений.",
                suffix: "debt.\(debt.id)"
            )
        }

        for goal in current.goals {
            guard let oldGoal = previous.goals.first(where: { $0.id == goal.id }),
                  goal.savedAmount > oldGoal.savedAmount else { continue }
            let progress = goal.targetAmount > 0 ? Int((goal.savedAmount / goal.targetAmount * 100).rounded()) : 0
            await deliverFamilyNotification(
                title: "Сімейну ціль поповнено",
                body: "«\(goal.title)» — уже \(min(progress, 100))%.",
                suffix: "goal.\(goal.id).\(Int(goal.savedAmount))"
            )
        }
    }

    func notifyFamilyMembershipChanges(
        previous: FamilySummary,
        current: FamilySummary,
        currentUserID: String
    ) async {
        guard preferences.familyUpdates else { return }
        await refreshAuthorizationStatus()
        guard authorizationStatus == .authorized || authorizationStatus == .provisional else { return }

        let previousIDs = Set(previous.members.map(\.userID))
        let currentIDs = Set(current.members.map(\.userID))

        for member in current.members where !previousIDs.contains(member.userID) && member.userID != currentUserID {
            await deliverFamilyNotification(
                title: "Новий учасник сім’ї",
                body: "\(member.displayName) приєднався(-лася) до «\(current.name)».",
                suffix: "member.joined.\(current.id).\(member.userID)"
            )
        }

        for member in previous.members where !currentIDs.contains(member.userID) && member.userID != currentUserID {
            await deliverFamilyNotification(
                title: "Учасник залишив сім’ю",
                body: "\(member.displayName) більше не є учасником «\(current.name)».",
                suffix: "member.left.\(current.id).\(member.userID)"
            )
        }

        for member in current.members where member.userID != currentUserID {
            guard let old = previous.member(id: member.userID),
                  old.canEditBudget != member.canEditBudget || old.canInviteMembers != member.canInviteMembers else { continue }
            await deliverFamilyNotification(
                title: "Права учасника змінено",
                body: "Для \(member.displayName) оновлено дозволи у «\(current.name)».",
                suffix: "member.permissions.\(current.id).\(member.userID).\(Date.now.timeIntervalSince1970)"
            )
        }
    }

    private func scheduleDailyReminder() async {
        let content = content(
            title: "Чи все внесено?",
            body: "Додайте сьогоднішні витрати, щоб аналітика залишалася точною.",
            category: Self.financeCategory,
            interruption: .active
        )
        var components = DateComponents()
        components.hour = preferences.dailyReminderMinutes / 60
        components.minute = preferences.dailyReminderMinutes % 60
        await add(
            identifier: "\(Self.requestPrefix)daily",
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        )
    }

    private func scheduleUpcomingPayments(store: FinanceStore) async {
        for debt in store.debts where !debt.isPaid && debt.direction == .iOwe {
            guard let dueDate = debt.dueDate,
                  let reminderDate = Calendar.current.date(byAdding: .day, value: -1, to: dueDate),
                  reminderDate > .now else { continue }
            let amount = preferences.showAmounts ? " — \(debt.currency.formatted(debt.amount))" : ""
            let notification = content(
                title: "Завтра запланована оплата",
                body: "Борг для \(debt.person)\(amount).",
                category: Self.financeCategory,
                interruption: .active
            )
            await addCalendar(identifier: "payment.\(debt.id)", content: notification, date: reminderDate, hour: 9)
        }
    }

    private func scheduleDebtReminders(store: FinanceStore) async {
        for debt in store.debts where !debt.isPaid && debt.direction == .owedToMe {
            guard let dueDate = debt.dueDate, dueDate > .now else { continue }
            let amount = preferences.showAmounts ? " — \(debt.currency.formatted(debt.amount))" : ""
            let notification = content(
                title: "Сьогодні мають повернути борг",
                body: "\(debt.person)\(amount).",
                category: Self.financeCategory,
                interruption: .active
            )
            await addCalendar(identifier: "debt.\(debt.id)", content: notification, date: dueDate, hour: 9)
        }
    }

    private func scheduleRecurringOperations(store: FinanceStore) async {
        let candidates = store.transactions.filter { !$0.note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let groups = Dictionary(grouping: candidates) {
            "\($0.kind.rawValue)|\($0.walletID)|\($0.note.lowercased())"
        }
        for rows in groups.values where rows.count >= 2 {
            let sorted = rows.sorted { $0.date < $1.date }
            guard let last = sorted.last,
                  let previous = sorted.dropLast().last else { continue }
            let days = Calendar.current.dateComponents([.day], from: previous.date, to: last.date).day ?? 0
            guard (20...40).contains(days),
                  let next = Calendar.current.date(byAdding: .month, value: 1, to: last.date),
                  next > .now else { continue }
            let amount = preferences.showAmounts ? " — \(last.currency.formatted(last.amount))" : ""
            let notification = content(
                title: "Час додати регулярну операцію",
                body: "\(last.note)\(amount).",
                category: Self.financeCategory,
                interruption: .active
            )
            await addCalendar(identifier: "recurring.\(last.id)", content: notification, date: next)
        }
    }

    private func scheduleGoalDeadlines(store: FinanceStore) async {
        for goal in store.goals where goal.savedAmount < goal.targetAmount {
            guard let dueDate = goal.dueDate, dueDate > .now else { continue }
            let remaining = max(0, goal.targetAmount - goal.savedAmount)
            let amount = preferences.showAmounts ? " Залишилося \(goal.currency.formatted(remaining))." : ""
            let notification = content(
                title: "Наближається строк цілі",
                body: "«\(goal.title)».\(amount)",
                category: Self.financeCategory,
                interruption: .active
            )
            await addCalendar(identifier: "goal.deadline.\(goal.id)", content: notification, date: dueDate, hour: 9)
        }
    }

    private func evaluateGoalProgress(store: FinanceStore) async {
        for goal in store.goals where goal.targetAmount > 0 {
            let progress = min(100, Int((goal.savedAmount / goal.targetAmount * 100).rounded(.down)))
            guard let threshold = [100, 75, 50, 25].first(where: { progress >= $0 }) else { continue }
            let marker = "\(Self.requestPrefix)marker.goal.\(goal.id).\(threshold)"
            guard !UserDefaults.standard.bool(forKey: marker) else { continue }
            for passed in [25, 50, 75, 100] where passed <= threshold {
                UserDefaults.standard.set(true, forKey: "\(Self.requestPrefix)marker.goal.\(goal.id).\(passed)")
            }
            await deliverImmediate(
                identifier: "goal.progress.\(goal.id).\(threshold)",
                title: threshold == 100 ? "Ціль досягнуто" : "Ціль стала ближчою",
                body: "«\(goal.title)» — уже \(threshold)%.",
                category: Self.financeCategory
            )
        }
    }

    private func scheduleSummaries(store: FinanceStore, familyName: String?) async {
        let space = familyName.map { " у «\($0)»" } ?? ""
        let weeklyBody = summaryBody(store: store, prefix: "За цей тиждень\(space)")
        var weekly = DateComponents()
        weekly.weekday = 1
        weekly.hour = 19
        await add(
            identifier: "\(Self.requestPrefix)summary.weekly",
            content: content(title: "Підсумок тижня", body: weeklyBody, category: Self.financeCategory, interruption: .passive),
            trigger: UNCalendarNotificationTrigger(dateMatching: weekly, repeats: true)
        )

        var monthly = DateComponents()
        monthly.day = 1
        monthly.hour = 9
        await add(
            identifier: "\(Self.requestPrefix)summary.monthly",
            content: content(title: "Підсумок місяця", body: summaryBody(store: store, prefix: "За минулий період\(space)"), category: Self.financeCategory, interruption: .passive),
            trigger: UNCalendarNotificationTrigger(dateMatching: monthly, repeats: true)
        )
    }

    private func evaluateBudget(store: FinanceStore) async {
        guard store.budgetLimit > 0 else { return }
        let ratio = store.monthlyExpenses / store.budgetLimit
        guard let threshold = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : nil else { return }
        let month = Date.now.formatted(.dateTime.year().month(.twoDigits))
        let marker = "\(Self.requestPrefix)marker.budget.\(month).\(threshold)"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        UserDefaults.standard.set(true, forKey: marker)
        let body = preferences.showAmounts
            ? "Використано \(store.mainCurrency.formatted(store.monthlyExpenses)) із \(store.mainCurrency.formatted(store.budgetLimit))."
            : threshold == 100 ? "Місячний ліміт перевищено." : "Використано 80% місячного ліміту."
        await deliverImmediate(
            identifier: "budget.\(month).\(threshold)",
            title: threshold == 100 ? "Ліміт витрат перевищено" : "Бюджет майже вичерпано",
            body: body,
            category: Self.financeCategory
        )
    }

    private func evaluateBalanceForecast(store: FinanceStore) async {
        let calendar = Calendar.current
        guard let dayRange = calendar.range(of: .day, in: .month, for: .now),
              let currentDay = calendar.dateComponents([.day], from: .now).day,
              currentDay >= 3,
              store.monthlyExpenses > 0 else { return }
        let dailyAverage = store.monthlyExpenses / Double(currentDay)
        let projected = store.totalBalanceInMainCurrency - dailyAverage * Double(dayRange.count - currentDay)
        guard projected < 0 else { return }
        let month = Date.now.formatted(.dateTime.year().month(.twoDigits))
        let marker = "\(Self.requestPrefix)marker.forecast.\(month)"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        UserDefaults.standard.set(true, forKey: marker)
        let body = preferences.showAmounts
            ? "За поточним темпом наприкінці місяця може бракувати \(store.mainCurrency.formatted(abs(projected)))."
            : "За поточним темпом коштів може не вистачити до кінця місяця."
        await deliverImmediate(
            identifier: "forecast.\(month)",
            title: "Прогнозований низький залишок",
            body: body,
            category: Self.financeCategory
        )
    }

    private func deliverFamilyNotification(title: String, body: String, suffix: String) async {
        await deliverImmediate(
            identifier: "family.\(suffix)",
            title: title,
            body: body,
            category: Self.familyCategory,
            url: "planer://family"
        )
    }

    private func deliverImmediate(
        identifier: String,
        title: String,
        body: String,
        category: String,
        url: String? = nil
    ) async {
        await add(
            identifier: "\(Self.requestPrefix)\(identifier)",
            content: content(title: title, body: body, category: category, interruption: .active, url: url),
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
    }

    private func addCalendar(
        identifier: String,
        content: UNMutableNotificationContent,
        date: Date,
        hour: Int? = nil
    ) async {
        var components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        if let hour {
            components.hour = hour
            components.minute = 0
        }
        await add(
            identifier: "\(Self.requestPrefix)\(identifier)",
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        )
    }

    private func add(identifier: String, content: UNMutableNotificationContent, trigger: UNNotificationTrigger) async {
        do {
            try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func content(
        title: String,
        body: String,
        category: String,
        interruption: UNNotificationInterruptionLevel,
        url: String? = nil
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = category
        content.interruptionLevel = interruption
        if let url { content.userInfo["url"] = url }
        return content
    }

    private func summaryBody(store: FinanceStore, prefix: String) -> String {
        guard preferences.showAmounts else { return "\(prefix) аналітика оновлена й готова до перегляду." }
        return "\(prefix): витрати \(store.mainCurrency.formatted(store.monthlyExpenses)), доходи \(store.mainCurrency.formatted(store.monthlyIncome))."
    }

    private func nonempty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func savePreferences() {
        guard let data = try? JSONEncoder().encode(preferences) else { return }
        UserDefaults.standard.set(data, forKey: Self.preferencesKey)
    }
}
