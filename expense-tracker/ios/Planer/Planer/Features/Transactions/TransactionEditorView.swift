import SwiftUI

struct TransactionEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let kind: FinanceTransactionKind

    @State private var amountText = ""
    @State private var walletID: UUID?
    @State private var destinationWalletID: UUID?
    @State private var category: TransactionCategory = .food
    @State private var note = ""
    @State private var date = Date.now

    var body: some View {
        ZStack {
            AtmosphericBackground()

            Form {
                Section {
                    TextField("0,00", text: $amountText)
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .accessibilityLabel("Сума")
                }

                Section("Гаманець") {
                    Picker("Звідки", selection: $walletID) {
                        Text("Оберіть гаманець").tag(UUID?.none)
                        ForEach(store.wallets) { wallet in
                            Text("\(wallet.name) · \(wallet.currency.rawValue)").tag(Optional(wallet.id))
                        }
                    }

                    if kind == .transfer {
                        Picker("Куди", selection: $destinationWalletID) {
                            Text("Оберіть гаманець").tag(UUID?.none)
                            ForEach(store.wallets.filter { $0.id != walletID }) { wallet in
                                Text("\(wallet.name) · \(wallet.currency.rawValue)").tag(Optional(wallet.id))
                            }
                        }
                    }
                }

                if kind != .transfer {
                    Section("Категорія") {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 10)], spacing: 10) {
                            ForEach(availableCategories) { item in
                                Button {
                                    category = item
                                } label: {
                                    VStack(spacing: 7) {
                                        Image(systemName: item.systemImage)
                                            .font(.headline)
                                        Text(item.title)
                                            .font(.caption.weight(.semibold))
                                            .lineLimit(1)
                                    }
                                    .foregroundStyle(category == item ? .white : item.tint)
                                    .frame(maxWidth: .infinity, minHeight: 66)
                                    .background(
                                        category == item ? item.tint : item.tint.opacity(0.13),
                                        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    )
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(item.title)
                                .accessibilityAddTraits(category == item ? .isSelected : [])
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("Деталі") {
                    TextField("Коментар", text: $note)
                    DatePicker("Дата", selection: $date, displayedComponents: [.date])
                    DatePicker("Час", selection: $date, displayedComponents: [.hourAndMinute])
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Зберегти", action: save)
                    .disabled(!canSave)
            }
        }
        .onAppear {
            walletID = walletID ?? store.wallets.first?.id
            if kind == .transfer {
                destinationWalletID = store.wallets.first { $0.id != walletID }?.id
            }
            if kind == .income { category = .salary }
        }
        .onChange(of: walletID) { _, newValue in
            guard kind == .transfer else { return }
            if destinationWalletID == newValue {
                destinationWalletID = store.wallets.first { $0.id != newValue }?.id
            }
        }
    }

    private var availableCategories: [TransactionCategory] {
        switch kind {
        case .expense:
            [.food, .transport, .home, .health, .shopping, .entertainment, .other]
        case .income:
            [.salary, .other]
        case .transfer:
            []
        }
    }

    private var parsedAmount: Double? {
        Double(amountText.replacingOccurrences(of: ",", with: "."))
    }

    private var canSave: Bool {
        guard let amount = parsedAmount, amount > 0, walletID != nil else { return false }
        return kind != .transfer || destinationWalletID != nil
    }

    private func save() {
        guard let amount = parsedAmount, let walletID else { return }
        store.addTransaction(
            kind: kind,
            amount: amount,
            walletID: walletID,
            destinationWalletID: destinationWalletID,
            category: category,
            note: note,
            date: date
        )
        dismiss()
    }
}

struct AddWalletView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var currency: Currency = .UAH
    @State private var balanceText = ""

    var body: some View {
        Form {
            Section("Новий гаманець") {
                TextField("Назва", text: $name)
                Picker("Валюта", selection: $currency) {
                    ForEach(Currency.allCases) { currency in
                        Text("\(currency.rawValue) — \(currency.title)").tag(currency)
                    }
                }
                TextField("Початковий баланс", text: $balanceText)
                    .keyboardType(.decimalPad)
            }
        }
        .navigationTitle("Додати гаманець")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Додати") {
                    let amount = Double(balanceText.replacingOccurrences(of: ",", with: ".")) ?? 0
                    store.addWallet(name: name, currency: currency, balance: amount)
                    dismiss()
                }
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }
}

struct BudgetEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var amountText = ""

    var body: some View {
        Form {
            Section("Ліміт витрат") {
                TextField("Сума", text: $amountText)
                    .keyboardType(.decimalPad)
                Text("Поточні витрати: \(store.mainCurrency.formatted(store.monthlyExpenses))")
                    .foregroundStyle(.secondary)
            }

            Section {
                Button("Прибрати ліміт", role: .destructive) {
                    store.setBudgetLimit(0)
                    dismiss()
                }
            }
        }
        .navigationTitle("Місячний ліміт")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Зберегти") {
                    let amount = Double(amountText.replacingOccurrences(of: ",", with: ".")) ?? 0
                    store.setBudgetLimit(amount)
                    dismiss()
                }
            }
        }
        .onAppear { amountText = String(format: "%.0f", store.budgetLimit) }
    }
}
