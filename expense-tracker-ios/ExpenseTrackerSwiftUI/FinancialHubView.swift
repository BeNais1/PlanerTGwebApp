import SwiftUI

private enum HubTab: String, CaseIterable, Identifiable {
    case goals
    case auto
    case search
    case recurring
    case debts
    case receipts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .goals: return "Goals"
        case .auto: return "Auto"
        case .search: return "Search"
        case .recurring: return "Recurring"
        case .debts: return "Debts"
        case .receipts: return "Receipts"
        }
    }
}

struct FinancialHubView: View {
    @EnvironmentObject private var store: AppStore
    @State private var activeTab: HubTab = .goals

    @State private var goalTitle = ""
    @State private var goalTarget = ""
    @State private var goalSaved = ""
    @State private var goalDueDate = Date()
    @State private var includeGoalDate = false

    @State private var debtPerson = ""
    @State private var debtAmount = ""
    @State private var debtDueDate = Date()
    @State private var includeDebtDate = false
    @State private var debtDirection: DebtDirection = .owedToMe

    @State private var subscriptionName = ""
    @State private var subscriptionAmount = ""
    @State private var subscriptionPeriod: SubscriptionPeriod = .monthly
    @State private var subscriptionNextDate = Date()
    @State private var subscriptionCategory = "subscriptions"
    @State private var subscriptionIcon = "repeat.circle.fill"

    @State private var search = ""

    private var autoSuggestions: [AutoSuggestion] {
        store.transactions
            .filter { $0.kind == .expense && !$0.note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .compactMap { item in
                guard let suggested = store.suggestedCategory(for: item.note), suggested != item.category else {
                    return nil
                }
                return AutoSuggestion(item: item, suggestedCategory: suggested)
            }
            .prefix(12)
            .map { $0 }
    }

    private var searchResults: [TransactionItem] {
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let source = store.transactions.sorted { $0.date > $1.date }
        guard !needle.isEmpty else { return Array(source.prefix(40)) }
        return source.filter { item in
            let haystack = "\(item.note) \(item.category) \(item.amount) \(item.currency.rawValue)".lowercased()
            return haystack.contains(needle)
        }
        .prefix(40)
        .map { $0 }
    }

    private var debtToMeTotal: Double {
        store.settings.debts
            .filter { !$0.isPaid && $0.direction == .owedToMe }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    private var debtIOweTotal: Double {
        store.settings.debts
            .filter { !$0.isPaid && $0.direction == .iOwe }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Financial Hub")
                            .font(.largeTitle.weight(.bold))
                            .foregroundStyle(.white)
                        Text("Goals, auto-categorization, search, recurring payments, debts, and receipts")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.66))
                    }

                    tabBar

                    switch activeTab {
                    case .goals:
                        goalsSection
                    case .auto:
                        autoSection
                    case .search:
                        searchSection
                    case .recurring:
                        recurringSection
                    case .debts:
                        debtsSection
                    case .receipts:
                        receiptsSection
                    }
                }
                .padding(18)
                .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HubTab.allCases) { tab in
                    Button {
                        activeTab = tab
                    } label: {
                        Text(tab.title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(activeTab == tab ? .white : .white.opacity(0.7))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(activeTab == tab ? .white.opacity(0.18) : .white.opacity(0.08))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .glassCard(cornerRadius: 16)
    }

    private var goalsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Smart Goals")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            VStack(spacing: 10) {
                TextField("Goal title", text: $goalTitle)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    TextField("Target amount", text: $goalTarget)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    TextField("Saved now", text: $goalSaved)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                }
                Toggle("Add due date", isOn: $includeGoalDate)
                    .tint(.mint)
                    .foregroundStyle(.white)
                if includeGoalDate {
                    DatePicker("Due date", selection: $goalDueDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .foregroundStyle(.white)
                }
                Button("Add Goal") {
                    let target = parseAmount(goalTarget)
                    let saved = parseAmount(goalSaved)
                    guard !goalTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, target > 0 else { return }
                    store.addGoal(
                        title: goalTitle.trimmingCharacters(in: .whitespacesAndNewlines),
                        targetAmount: target,
                        savedAmount: saved,
                        dueDate: includeGoalDate ? goalDueDate : nil
                    )
                    goalTitle = ""
                    goalTarget = ""
                    goalSaved = ""
                    includeGoalDate = false
                }
                .buttonStyle(.borderedProminent)
                .tint(.mint)
            }
            .glassCard(cornerRadius: 18)

            ForEach(store.settings.smartGoals) { goal in
                let progress = goal.targetAmount > 0 ? min(goal.savedAmount / goal.targetAmount, 1) : 0
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(goal.title)
                                .font(.headline.weight(.semibold))
                                .foregroundStyle(.white)
                            Text(goal.dueDate?.formatted(date: .abbreviated, time: .omitted) ?? "No due date")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer()
                        Text("\(Int(progress * 100))%")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.mint)
                    }

                    GeometryReader { proxy in
                        Capsule()
                            .fill(.white.opacity(0.12))
                            .overlay(alignment: .leading) {
                                Capsule()
                                    .fill(.mint.gradient)
                                    .frame(width: proxy.size.width * progress)
                            }
                    }
                    .frame(height: 8)

                    HStack {
                        Text(store.formatted(goal.savedAmount, currency: goal.currency))
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("of \(store.formatted(goal.targetAmount, currency: goal.currency))")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.64))
                    }

                    HStack {
                        Button("Top up +10") {
                            store.topUpGoal(goal, amount: 10)
                        }
                        .buttonStyle(.bordered)
                        .tint(.mint)

                        Spacer()

                        Button("Delete", role: .destructive) {
                            store.removeGoal(goal)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .glassCard(cornerRadius: 18)
            }
        }
    }

    private var autoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Auto-categorization suggestions")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            if autoSuggestions.isEmpty {
                Text("No suggestions right now.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
                    .glassCard(cornerRadius: 16)
            } else {
                ForEach(autoSuggestions) { suggestion in
                    Button {
                        var updated = suggestion.item
                        updated.category = suggestion.suggestedCategory
                        store.updateTransaction(updated)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(suggestion.item.note)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(suggestion.item.category) → \(suggestion.suggestedCategory)")
                                    .font(.caption)
                            }
                            Spacer()
                            Text(store.formatted(suggestion.item.amount, currency: suggestion.item.currency))
                                .font(.subheadline.weight(.bold))
                        }
                        .foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .glassCard(cornerRadius: 16)
                }
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Search by note/category/amount", text: $search)
                .textFieldStyle(.roundedBorder)
                .glassCard(cornerRadius: 16)

            ForEach(searchResults) { item in
                TransactionRow(item: item)
            }
        }
    }

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recurring Payments")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            VStack(spacing: 10) {
                TextField("Subscription name", text: $subscriptionName)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    TextField("Amount", text: $subscriptionAmount)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Picker("Period", selection: $subscriptionPeriod) {
                        ForEach(SubscriptionPeriod.allCases) { period in
                            Text(period.title).tag(period)
                        }
                    }
                    .pickerStyle(.menu)
                }
                HStack {
                    TextField("Category id", text: $subscriptionCategory)
                        .textFieldStyle(.roundedBorder)
                    TextField("SF Symbol", text: $subscriptionIcon)
                        .textFieldStyle(.roundedBorder)
                }
                DatePicker("Next charge", selection: $subscriptionNextDate, displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .foregroundStyle(.white)
                Button("Add Subscription") {
                    let amount = parseAmount(subscriptionAmount)
                    guard !subscriptionName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, amount > 0 else { return }
                    store.addSubscription(
                        name: subscriptionName.trimmingCharacters(in: .whitespacesAndNewlines),
                        amount: amount,
                        category: subscriptionCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "subscriptions" : subscriptionCategory.trimmingCharacters(in: .whitespacesAndNewlines),
                        icon: subscriptionIcon.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "repeat.circle.fill" : subscriptionIcon.trimmingCharacters(in: .whitespacesAndNewlines),
                        period: subscriptionPeriod,
                        nextDate: subscriptionNextDate
                    )
                    subscriptionName = ""
                    subscriptionAmount = ""
                    subscriptionCategory = "subscriptions"
                    subscriptionIcon = "repeat.circle.fill"
                }
                .buttonStyle(.borderedProminent)
                .tint(.mint)
            }
            .glassCard(cornerRadius: 18)

            ForEach(store.settings.subscriptions) { sub in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(sub.icon) \(sub.name)")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.white)
                        Text("\(sub.period.title) · \(sub.nextDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.66))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        Text(store.formatted(sub.amount, currency: sub.currency))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                        HStack {
                            Button(sub.isActive ? "Pause" : "Resume") {
                                store.toggleSubscriptionActive(sub)
                            }
                            .buttonStyle(.bordered)

                            Button("Delete", role: .destructive) {
                                store.removeSubscription(sub)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                .glassCard(cornerRadius: 16)
            }
        }
    }

    private var debtsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                debtMetric(title: "Owed to me", value: store.formatted(debtToMeTotal))
                debtMetric(title: "I owe", value: store.formatted(debtIOweTotal))
            }

            VStack(spacing: 10) {
                TextField("Person", text: $debtPerson)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    TextField("Amount", text: $debtAmount)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                    Picker("Direction", selection: $debtDirection) {
                        ForEach(DebtDirection.allCases) { direction in
                            Text(direction.title).tag(direction)
                        }
                    }
                    .pickerStyle(.menu)
                }
                Toggle("Add due date", isOn: $includeDebtDate)
                    .tint(.mint)
                    .foregroundStyle(.white)
                if includeDebtDate {
                    DatePicker("Due date", selection: $debtDueDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .foregroundStyle(.white)
                }
                Button("Add Debt") {
                    let amount = parseAmount(debtAmount)
                    guard !debtPerson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, amount > 0 else { return }
                    store.addDebt(
                        person: debtPerson.trimmingCharacters(in: .whitespacesAndNewlines),
                        amount: amount,
                        dueDate: includeDebtDate ? debtDueDate : nil,
                        direction: debtDirection
                    )
                    debtPerson = ""
                    debtAmount = ""
                    includeDebtDate = false
                }
                .buttonStyle(.borderedProminent)
                .tint(.mint)
            }
            .glassCard(cornerRadius: 18)

            ForEach(store.settings.debts) { debt in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(debt.person)
                            .font(.headline.weight(.semibold))
                        Text("\(debt.direction.title) · \(debt.dueDate?.formatted(date: .abbreviated, time: .omitted) ?? "No due date")")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.66))
                    }
                    .foregroundStyle(.white)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        Text(store.formatted(debt.amount, currency: debt.currency))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                        HStack {
                            Button(debt.isPaid ? "Reopen" : "Paid") {
                                store.toggleDebtPaid(debt)
                            }
                            .buttonStyle(.bordered)

                            Button("Delete", role: .destructive) {
                                store.removeDebt(debt)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                .opacity(debt.isPaid ? 0.65 : 1)
                .glassCard(cornerRadius: 16)
            }
        }
    }

    private var receiptsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Saved Receipts")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            if store.receipts.isEmpty {
                Text("No saved receipts yet.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.66))
                    .glassCard(cornerRadius: 16)
            } else {
                ForEach(store.receipts) { receipt in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(receipt.title)
                                .font(.headline.weight(.semibold))
                            Spacer()
                            Text(store.formatted(receipt.amount, currency: receipt.currency))
                                .font(.subheadline.weight(.bold))
                        }
                        Text("\(receipt.merchant) · \(receipt.date.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.66))
                    }
                    .foregroundStyle(.white)
                    .glassCard(cornerRadius: 16)
                }
            }
        }
    }

    private func debtMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.66))
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(cornerRadius: 16)
    }

    private func parseAmount(_ value: String) -> Double {
        Double(value.replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}

private struct AutoSuggestion: Identifiable {
    let item: TransactionItem
    let suggestedCategory: String

    var id: UUID { item.id }
}
