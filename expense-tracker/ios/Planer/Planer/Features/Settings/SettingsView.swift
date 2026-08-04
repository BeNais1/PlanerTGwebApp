import SwiftUI

struct SettingsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AuthSession.self) private var authSession
    @Environment(FirebaseSyncStore.self) private var syncStore
    @Environment(DailyFinanceLiveActivityManager.self) private var liveActivityManager
    @Environment(\.dismiss) private var dismiss
    @State private var showClearConfirmation = false

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

            Section("Дані") {
                LabeledContent("Простір", value: store.activeSpaceName)
                LabeledContent("Сховище", value: "Firebase + локальний кеш")
                Label(syncStore.status.title, systemImage: syncStatusIcon)
                    .foregroundStyle(syncStatusColor)

                if case .error(let message) = syncStore.status {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(PlanerTheme.negative)
                }
            }

            Section("Dynamic Island і екран блокування") {
                Label(liveActivityManager.status.title, systemImage: liveActivityManager.status.systemImage)
                    .foregroundStyle(liveActivityStatusColor)

                if case .failed(let details) = liveActivityManager.status {
                    Text(details)
                        .font(.caption)
                        .foregroundStyle(PlanerTheme.negative)
                        .textSelection(.enabled)
                } else if liveActivityManager.status == .disabled {
                    Text("Увімкніть Live Activities у Налаштуваннях iPhone → Planer → Live Activities.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if liveActivityManager.status == .active {
                    Text("Live Activity створено. Якщо капсула порожня, підпишіть не лише Planer, а й вкладене розширення з Bundle ID planer.liveactivity.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Показує витрати та дохід за сьогодні. Після запуску заблокуйте екран або згорніть Planer.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Button("Запустити повторно") {
                    Task {
                        await liveActivityManager.refresh(with: liveActivitySnapshot, forceRestart: true)
                    }
                }
                .disabled(liveActivityManager.status == .starting)
            }

            Section("Обліковий запис Google") {
                if case .signedIn(let user) = authSession.state {
                    LabeledContent("Користувач", value: user.displayName)
                    if !user.email.isEmpty {
                        LabeledContent("Електронна пошта", value: user.email)
                    }
                }

                Button("Вийти", role: .destructive) {
                    dismiss()
                    authSession.signOut()
                }
            }

            Section {
                Button("Видалити всі дані", role: .destructive) {
                    showClearConfirmation = true
                }
                Text("Гаманці, операції, цілі та борги буде видалено з пристрою і Firebase.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Про застосунок") {
                LabeledContent("Версія", value: appVersion)
                LabeledContent("Мінімальна iOS", value: "17.0")
                LabeledContent("Liquid Glass", value: "iOS 26+")
            }
        }
        .navigationTitle("Налаштування")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(store.prefersDarkAppearance ? .dark : .light)
        .animation(.easeInOut(duration: 0.22), value: store.prefersDarkAppearance)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
        .confirmationDialog(
            "Видалити всі фінансові дані?",
            isPresented: $showClearConfirmation,
            titleVisibility: .visible
        ) {
            Button("Видалити", role: .destructive) { store.clearAllData() }
            Button("Скасувати", role: .cancel) { }
        } message: {
            Text("Цю дію неможливо скасувати.")
        }
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "\(version) (\(build))"
    }

    private var liveActivitySnapshot: DailyFinanceSnapshot {
        DailyFinanceSnapshot(
            expenses: store.todayExpenses,
            income: store.todayIncome,
            currencySymbol: store.mainCurrency.symbol
        )
    }

    private var liveActivityStatusColor: Color {
        switch liveActivityManager.status {
        case .active: PlanerTheme.positive
        case .failed, .disabled: PlanerTheme.negative
        case .checking, .waitingForForeground, .starting: PlanerTheme.warning
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
        .environment(DailyFinanceLiveActivityManager.shared)
}
