import SwiftUI

struct AddTransactionSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var kind: TransactionKind = .expense
    @State private var amount = ""
    @State private var currency: CurrencyCode = .eur
    @State private var category = expenseCategories.first?.id ?? "other"
    @State private var note = ""
    @State private var date = Date()

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $kind) {
                    ForEach(TransactionKind.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                Section("Amount") {
                    TextField("0.00", text: $amount)
                        .keyboardType(.decimalPad)
                    Picker("Currency", selection: $currency) {
                        ForEach(CurrencyCode.allCases) { code in
                            Text("\(code.rawValue) \(code.symbol)").tag(code)
                        }
                    }
                }

                Section("Details") {
                    if kind == .expense {
                        Picker("Category", selection: $category) {
                            ForEach(expenseCategories) { item in
                                Label(item.title, systemImage: item.symbol).tag(item.id)
                            }
                        }
                    }
                    TextField("Note", text: $note)
                    DatePicker("Date", selection: $date, displayedComponents: [.date, .hourAndMinute])
                }
            }
            .navigationTitle(kind == .expense ? "New Expense" : "New Income")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        save()
                    }
                    .disabled(parsedAmount <= 0)
                }
            }
        }
        .onAppear {
            currency = store.settings.mainCurrency
        }
    }

    private var parsedAmount: Double {
        Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private func save() {
        store.addTransaction(
            kind: kind,
            amount: parsedAmount,
            currency: currency,
            category: kind == .income ? "income" : category,
            note: note,
            date: date
        )
        dismiss()
    }
}
