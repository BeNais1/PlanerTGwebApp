import SwiftUI

struct AddTransactionSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var kind: TransactionKind = .expense
    @State private var amount = ""
    @State private var currency: CurrencyCode = .eur
    @State private var category = expenseCategories.first?.title ?? "Другое"
    @State private var note = ""
    @State private var date = Date()

    var body: some View {
        NavigationStack {
            Form {
                Picker("Тип", selection: $kind) {
                    ForEach(TransactionKind.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                Section("Сумма") {
                    TextField("0.00", text: $amount)
                        .keyboardType(.decimalPad)
                    Picker("Валюта", selection: $currency) {
                        ForEach(CurrencyCode.allCases) { code in
                            Text("\(code.rawValue) \(code.symbol)").tag(code)
                        }
                    }
                }

                Section("Детали") {
                    Picker("Категория", selection: $category) {
                        ForEach(expenseCategories) { item in
                            Label(item.title, systemImage: item.symbol).tag(item.title)
                        }
                    }
                    TextField("Описание", text: $note)
                    DatePicker("Дата", selection: $date, displayedComponents: [.date, .hourAndMinute])
                }
            }
            .navigationTitle(kind == .expense ? "Новый расход" : "Новый доход")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") {
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
            category: kind == .income ? "Доход" : category,
            note: note,
            date: date
        )
        dismiss()
    }
}
