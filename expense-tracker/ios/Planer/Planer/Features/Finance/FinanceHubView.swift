import SwiftUI

private enum FinanceHubSection: String, CaseIterable, Identifiable {
    case goals
    case debts
    case search

    var id: String { rawValue }
    var title: String {
        switch self {
        case .goals: "Цілі"
        case .debts: "Борги"
        case .search: "Пошук"
        }
    }
}

struct FinanceHubView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router
    @State private var section: FinanceHubSection = .goals
    @State private var searchText = ""

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                VStack(spacing: 16) {
                    Picker("Розділ", selection: $section) {
                        ForEach(FinanceHubSection.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch section {
                    case .goals: goalsContent
                    case .debts: debtsContent
                    case .search: searchContent
                    }
                }
                .padding(18)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Фінанси")
        .searchable(text: $searchText, prompt: "Сума, опис або категорія")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if section == .goals || section == .debts {
                    Button {
                        router.presentedSheet = section == .goals ? .newGoal : .newDebt
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel(section == .goals ? "Додати ціль" : "Додати борг")
                }
            }
        }
    }

    private var goalsContent: some View {
        VStack(spacing: 12) {
            ForEach(store.goals) { goal in
                GoalCard(goal: goal)
            }
            if store.goals.isEmpty {
                ContentUnavailableView("Немає цілей", systemImage: "target", description: Text("Створіть першу фінансову ціль"))
                    .frame(minHeight: 280)
                    .contentCard()
            }
        }
    }

    private var debtsContent: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                debtSummary(direction: .owedToMe, tint: PlanerTheme.positive)
                debtSummary(direction: .iOwe, tint: PlanerTheme.negative)
            }

            ForEach(store.debts) { debt in
                Button {
                    store.toggleDebt(id: debt.id)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: debt.isPaid ? "checkmark.circle.fill" : "person.crop.circle")
                            .font(.title2)
                            .foregroundStyle(debt.isPaid ? PlanerTheme.positive : PlanerTheme.accent)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(debt.person).font(.headline)
                            Text(debt.direction.title).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(debt.currency.formatted(debt.amount))
                            .font(.subheadline.bold())
                            .strikethrough(debt.isPaid)
                    }
                    .padding(16)
                    .contentCard()
                    .opacity(debt.isPaid ? 0.55 : 1)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var searchContent: some View {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let rows = store.recentTransactions.filter { transaction in
            query.isEmpty
                || transaction.note.lowercased().contains(query)
                || transaction.category.title.lowercased().contains(query)
                || transaction.currency.formatted(transaction.amount).lowercased().contains(query)
        }

        return VStack(spacing: 0) {
            if rows.isEmpty {
                ContentUnavailableView.search(text: searchText)
                    .frame(minHeight: 280)
            } else {
                ForEach(rows) { transaction in
                    Button {
                        router.presentedSheet = .transaction(transaction)
                    } label: {
                        TransactionRowView(transaction: transaction)
                    }
                    .buttonStyle(.plain)
                    if transaction.id != rows.last?.id { Divider().padding(.leading, 62) }
                }
            }
        }
        .padding(.vertical, 6)
        .contentCard()
    }

    private func debtSummary(direction: DebtDirection, tint: Color) -> some View {
        let total = store.debts.filter { $0.direction == direction && !$0.isPaid }.reduce(0) {
            $0 + store.converted($1.amount, from: $1.currency, to: store.mainCurrency)
        }
        return VStack(alignment: .leading, spacing: 8) {
            Text(direction.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(store.mainCurrency.formatted(total))
                .font(.headline)
                .foregroundStyle(tint)
                .minimumScaleFactor(0.75)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .contentCard()
    }
}

private struct GoalCard: View {
    @Environment(FinanceStore.self) private var store
    let goal: SavingsGoal

    var body: some View {
        let progress = goal.targetAmount > 0 ? min(goal.savedAmount / goal.targetAmount, 1) : 0

        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(goal.title).font(.headline)
                    if let dueDate = goal.dueDate {
                        Text("До \(dueDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text("\(Int(progress * 100))%")
                    .font(.subheadline.bold())
                    .foregroundStyle(PlanerTheme.accent)
            }

            ProgressView(value: progress)
                .tint(PlanerTheme.accent)

            HStack {
                Text(goal.currency.formatted(goal.savedAmount))
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("з \(goal.currency.formatted(goal.targetAmount))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("+10%") {
                    store.topUpGoal(id: goal.id, amount: goal.targetAmount * 0.1)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(16)
        .contentCard()
    }
}

struct GoalEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var targetText = ""
    @State private var currency: Currency = .UAH
    @State private var hasDueDate = false
    @State private var dueDate = Calendar.current.date(byAdding: .month, value: 3, to: .now) ?? .now

    var body: some View {
        Form {
            Section("Нова ціль") {
                TextField("Назва", text: $title)
                TextField("Сума", text: $targetText).keyboardType(.decimalPad)
                Picker("Валюта", selection: $currency) {
                    ForEach(Currency.allCases) { Text($0.rawValue).tag($0) }
                }
            }
            Section {
                Toggle("Додати дедлайн", isOn: $hasDueDate)
                if hasDueDate { DatePicker("Дата", selection: $dueDate, displayedComponents: .date) }
            }
        }
        .navigationTitle("Фінансова ціль")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Додати") {
                    store.addGoal(title: title, target: parsedTarget, currency: currency, dueDate: hasDueDate ? dueDate : nil)
                    dismiss()
                }
                .disabled(title.isEmpty || parsedTarget <= 0)
            }
        }
    }

    private var parsedTarget: Double { Double(targetText.replacingOccurrences(of: ",", with: ".")) ?? 0 }
}

struct DebtEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var person = ""
    @State private var amountText = ""
    @State private var currency: Currency = .UAH
    @State private var direction: DebtDirection = .owedToMe

    var body: some View {
        Form {
            Section("Новий борг") {
                TextField("Ім’я", text: $person)
                TextField("Сума", text: $amountText).keyboardType(.decimalPad)
                Picker("Напрямок", selection: $direction) {
                    ForEach(DebtDirection.allCases) { Text($0.title).tag($0) }
                }
                Picker("Валюта", selection: $currency) {
                    ForEach(Currency.allCases) { Text($0.rawValue).tag($0) }
                }
            }
        }
        .navigationTitle("Борг")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Додати") {
                    store.addDebt(person: person, amount: parsedAmount, currency: currency, direction: direction, dueDate: nil)
                    dismiss()
                }
                .disabled(person.isEmpty || parsedAmount <= 0)
            }
        }
    }

    private var parsedAmount: Double { Double(amountText.replacingOccurrences(of: ",", with: ".")) ?? 0 }
}

#Preview("Finance hub") {
    NavigationStack { FinanceHubView() }
        .environment(FinanceStore(loadPersisted: false, persistsChanges: false))
        .environment(AppRouter())
        .preferredColorScheme(.dark)
}
