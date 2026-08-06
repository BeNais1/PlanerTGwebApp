import SwiftUI
import UIKit
import UserNotifications

struct NotificationSettingsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(FamilyAccountStore.self) private var familyStore
    @Environment(PlanerNotificationService.self) private var notificationService

    var body: some View {
        @Bindable var notificationService = notificationService

        Form {
            Section("Дозвіл") {
                Label(statusTitle, systemImage: statusIcon)
                    .foregroundStyle(statusColor)

                if notificationService.authorizationStatus == .notDetermined {
                    Button("Увімкнути сповіщення") {
                        Task {
                            if await notificationService.requestAuthorization() {
                                await reschedule()
                            }
                        }
                    }
                } else if notificationService.authorizationStatus == .denied {
                    Link("Відкрити налаштування iPhone", destination: URL(string: UIApplication.openSettingsURLString)!)
                }

                if let error = notificationService.lastError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(PlanerTheme.negative)
                }
            }

            Section("Щоденний облік") {
                Toggle("Нагадувати внести операції", isOn: $notificationService.preferences.dailyReminder)

                if notificationService.preferences.dailyReminder {
                    DatePicker(
                        "Час нагадування",
                        selection: reminderTime,
                        displayedComponents: .hourAndMinute
                    )
                }
            }

            Section("Бюджет і платежі") {
                Toggle("Наближення до ліміту", isOn: $notificationService.preferences.budgetAlerts)
                Toggle("Майбутні платежі", isOn: $notificationService.preferences.upcomingPayments)
                Toggle("Строки повернення боргів", isOn: $notificationService.preferences.debtReminders)
                Toggle("Регулярні операції", isOn: $notificationService.preferences.recurringOperations)
                Toggle("Прогноз низького залишку", isOn: $notificationService.preferences.lowBalanceForecast)
            }

            Section("Цілі й аналітика") {
                Toggle("Прогрес накопичувальних цілей", isOn: $notificationService.preferences.goalUpdates)
                Toggle("Тижневі та місячні підсумки", isOn: $notificationService.preferences.periodicSummaries)
            }

            Section("Сімейний бюджет") {
                Toggle("Сімейні події", isOn: $notificationService.preferences.familyUpdates)
                Text("Нові операції, чеки, поповнення цілей, закриті борги, учасники та зміни дозволів.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Конфіденційність") {
                Toggle("Показувати суми на екрані блокування", isOn: $notificationService.preferences.showAmounts)
                Text("Якщо вимкнути, Planer приховає суми в тексті сповіщень.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button("Оновити всі нагадування") {
                    Task { await reschedule() }
                }
                .disabled(!isAuthorized)
            }
        }
        .navigationTitle("Сповіщення")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await notificationService.refreshAuthorizationStatus()
        }
        .onChange(of: notificationService.preferences) { _, _ in
            Task { await reschedule() }
        }
    }

    private var reminderTime: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    bySettingHour: notificationService.preferences.dailyReminderMinutes / 60,
                    minute: notificationService.preferences.dailyReminderMinutes % 60,
                    second: 0,
                    of: .now
                ) ?? .now
            },
            set: { value in
                let components = Calendar.current.dateComponents([.hour, .minute], from: value)
                notificationService.preferences.dailyReminderMinutes =
                    (components.hour ?? 20) * 60 + (components.minute ?? 0)
            }
        )
    }

    private var isAuthorized: Bool {
        notificationService.authorizationStatus == .authorized
            || notificationService.authorizationStatus == .provisional
    }

    private var statusTitle: String {
        switch notificationService.authorizationStatus {
        case .authorized, .provisional, .ephemeral: "Сповіщення увімкнено"
        case .denied: "Сповіщення заборонено"
        case .notDetermined: "Потрібен дозвіл"
        @unknown default: "Стан невідомий"
        }
    }

    private var statusIcon: String {
        switch notificationService.authorizationStatus {
        case .authorized, .provisional, .ephemeral: "checkmark.circle.fill"
        case .denied: "bell.slash.fill"
        case .notDetermined: "bell.badge"
        @unknown default: "questionmark.circle"
        }
    }

    private var statusColor: Color {
        switch notificationService.authorizationStatus {
        case .authorized, .provisional, .ephemeral: PlanerTheme.positive
        case .denied: PlanerTheme.negative
        case .notDetermined: PlanerTheme.warning
        @unknown default: .secondary
        }
    }

    private func reschedule() async {
        await notificationService.rescheduleAll(
            store: store,
            familyName: familyStore.activeFamily?.name
        )
    }
}

#Preview("Notification settings") {
    NavigationStack { NotificationSettingsView() }
        .environment(FinanceStore.previewStore())
        .environment(FamilyAccountStore.preview())
        .environment(PlanerNotificationService.shared)
}
