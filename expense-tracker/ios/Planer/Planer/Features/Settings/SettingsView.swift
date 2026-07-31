import SwiftUI

struct SettingsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AuthSession.self) private var authSession
    @Environment(FirebaseSyncStore.self) private var syncStore
    @Environment(\.dismiss) private var dismiss
    @State private var showClearConfirmation = false

    var body: some View {
        Form {
            Section("Внешний вид") {
                Toggle(
                    "Тёмная тема",
                    isOn: Binding(
                        get: { store.prefersDarkAppearance },
                        set: { store.setDarkAppearance($0) }
                    )
                )

                Picker(
                    "Основная валюта",
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

            Section("Данные") {
                LabeledContent("Пространство", value: store.activeSpaceName)
                LabeledContent("Хранилище", value: "Firebase + локальный кеш")
                Label(syncStore.status.title, systemImage: syncStatusIcon)
                    .foregroundStyle(syncStatusColor)

                if case .error(let message) = syncStore.status {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(PlanerTheme.negative)
                }
            }

            Section("Аккаунт Google") {
                if case .signedIn(let user) = authSession.state {
                    LabeledContent("Пользователь", value: user.displayName)
                    if !user.email.isEmpty {
                        LabeledContent("Email", value: user.email)
                    }
                }

                Button("Выйти", role: .destructive) {
                    dismiss()
                    authSession.signOut()
                }
            }

            Section {
                Button("Удалить все данные", role: .destructive) {
                    showClearConfirmation = true
                }
                Text("Кошельки, операции, цели и долги будут удалены с устройства и из Firebase.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("О приложении") {
                LabeledContent("Версия", value: "1.0 (2)")
                LabeledContent("Минимальная iOS", value: "17.0")
                LabeledContent("Liquid Glass", value: "iOS 26+")
            }
        }
        .navigationTitle("Настройки")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
        .confirmationDialog(
            "Удалить все финансовые данные?",
            isPresented: $showClearConfirmation,
            titleVisibility: .visible
        ) {
            Button("Удалить", role: .destructive) { store.clearAllData() }
            Button("Отмена", role: .cancel) { }
        } message: {
            Text("Это действие нельзя отменить.")
        }
    }

    private var syncStatusIcon: String {
        switch syncStore.status {
        case .connecting: "arrow.triangle.2.circlepath.icloud"
        case .synced: "checkmark.icloud.fill"
        case .error: "exclamationmark.icloud.fill"
        }
    }

    private var syncStatusColor: Color {
        switch syncStore.status {
        case .connecting: .secondary
        case .synced: PlanerTheme.positive
        case .error: PlanerTheme.negative
        }
    }
}

#Preview("Settings") {
    NavigationStack { SettingsView() }
        .environment(FinanceStore.previewStore())
        .environment(AuthSession.preview())
        .environment(FirebaseSyncStore.preview())
}
