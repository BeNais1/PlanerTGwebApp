import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            Form {
                Section("Валюта") {
                    Picker("Основная валюта", selection: $store.settings.mainCurrency) {
                        ForEach(CurrencyCode.allCases) { code in
                            Text("\(code.rawValue) \(code.symbol)").tag(code)
                        }
                    }
                }

                Section("Бюджет") {
                    TextField(
                        "Лимит",
                        value: $store.settings.budgetLimit,
                        format: .number.precision(.fractionLength(2))
                    )
                    .keyboardType(.decimalPad)

                    Picker("Период", selection: $store.settings.budgetPeriod) {
                        ForEach(BudgetPeriod.allCases) { period in
                            Text(period.title).tag(period)
                        }
                    }
                }
            }
            .navigationTitle("Настройки")
        }
    }
}
