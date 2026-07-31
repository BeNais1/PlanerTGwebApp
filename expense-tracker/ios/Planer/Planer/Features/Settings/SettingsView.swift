import SwiftUI

struct SettingsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var showResetConfirmation = false

    var body: some View {
        Form {
            Section("Вигляд") {
                Toggle(
                    "Темна тема",
                    isOn: Binding(
                        get: { store.prefersDarkAppearance },
                        set: { store.setDarkAppearance($0) }
                    )
                )

                Picker(
                    "Основна валюта",
                    selection: Binding(
                        get: { store.mainCurrency },
                        set: { store.setMainCurrency($0) }
                    )
                ) {
                    ForEach(Currency.allCases) { currency in
                        Text("\(currency.rawValue) — \(currency.symbol)").tag(currency)
                    }
                }
            }

            Section("Простір") {
                LabeledContent("Активний бюджет", value: store.activeSpaceName)
                LabeledContent("Режим даних", value: "Локальне демо")
                Label("На пристрої", systemImage: "iphone")
                    .foregroundStyle(.secondary)
            }

            Section("Синхронізація") {
                Label("Telegram / Firebase не підключено", systemImage: "exclamationmark.icloud.fill")
                    .foregroundStyle(PlanerTheme.warning)
                Text("Нативний застосунок потребує окремого входу та backend-ендпоінтів для особистих гаманців і операцій. Код підготовлено як local-first клієнт без передачі тестових даних назовні.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button("Відновити демо-дані", role: .destructive) {
                    showResetConfirmation = true
                }
            }

            Section("Про застосунок") {
                LabeledContent("Версія", value: "1.0 (1)")
                LabeledContent("Мінімальна iOS", value: "17.0")
                LabeledContent("Liquid Glass", value: "iOS 26+")
            }
        }
        .navigationTitle("Налаштування")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
        .confirmationDialog(
            "Відновити початкові демо-дані?",
            isPresented: $showResetConfirmation,
            titleVisibility: .visible
        ) {
            Button("Відновити", role: .destructive) { store.resetDemoData() }
            Button("Скасувати", role: .cancel) { }
        }
    }
}

#Preview("Settings") {
    NavigationStack { SettingsView() }
        .environment(FinanceStore(loadPersisted: false, persistsChanges: false))
}
