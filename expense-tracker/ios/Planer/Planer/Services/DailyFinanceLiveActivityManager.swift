import ActivityKit
import Foundation
import Observation
import UIKit

struct DailyFinanceSnapshot: Hashable {
    let expenses: Double
    let income: Double
    let currencySymbol: String
}

@MainActor
@Observable
final class DailyFinanceLiveActivityManager {
    enum Status: Equatable {
        case checking
        case disabled
        case waitingForForeground
        case starting
        case active
        case failed(String)

        var title: String {
            switch self {
            case .checking: "Перевіряємо"
            case .disabled: "Вимкнено в iOS"
            case .waitingForForeground: "Очікує відкриття Planer"
            case .starting: "Запускаємо"
            case .active: "Працює"
            case .failed: "Помилка запуску"
            }
        }

        var systemImage: String {
            switch self {
            case .checking, .starting: "arrow.triangle.2.circlepath"
            case .disabled: "livephoto.slash"
            case .waitingForForeground: "hourglass"
            case .active: "checkmark.circle.fill"
            case .failed: "exclamationmark.triangle.fill"
            }
        }
    }

    static let shared = DailyFinanceLiveActivityManager()
    private(set) var status: Status = .checking
    private(set) var installationDetails: String?

    private init() {}

    func refresh(with snapshot: DailyFinanceSnapshot, forceRestart: Bool = false) async {
        let hostBundleID = Bundle.main.bundleIdentifier ?? "невідомий"
        guard let plugInsURL = Bundle.main.builtInPlugInsURL else {
            installationDetails = "App: \(hostBundleID)\nExtension: відсутній"
            status = .failed("Розширення PlanerLiveActivity.appex відсутнє. Підписувач IPA видалив його або не встановив.")
            return
        }
        let extensionURL = plugInsURL.appendingPathComponent("PlanerLiveActivity.appex")
        guard FileManager.default.fileExists(atPath: extensionURL.path),
              let extensionBundle = Bundle(url: extensionURL),
              let extensionBundleID = extensionBundle.bundleIdentifier else {
            installationDetails = "App: \(hostBundleID)\nExtension: відсутній"
            status = .failed("Розширення PlanerLiveActivity.appex відсутнє або має пошкоджений Info.plist.")
            return
        }
        installationDetails = "App: \(hostBundleID)\nExtension: \(extensionBundleID)"

        guard extensionBundleID.hasPrefix(hostBundleID + ".") else {
            status = .failed("Bundle ID розширення не належить застосунку. У Sideloadly потрібно підписати вкладений Plug-in окремо та не видаляти його.")
            return
        }
        guard let executableURL = extensionBundle.executableURL,
              FileManager.default.fileExists(atPath: executableURL.path) else {
            status = .failed("У PlanerLiveActivity.appex відсутній виконуваний файл.")
            return
        }
        let extensionPoint = (extensionBundle.infoDictionary?["NSExtension"] as? [String: Any])?["NSExtensionPointIdentifier"] as? String
        guard extensionPoint == "com.apple.widgetkit-extension" else {
            status = .failed("PlanerLiveActivity.appex не зареєстровано як WidgetKit extension.")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            status = .disabled
            return
        }

        let now = Date.now
        let state = DailyFinanceActivityAttributes.ContentState(
            expenses: snapshot.expenses,
            income: snapshot.income,
            currencySymbol: snapshot.currencySymbol,
            updatedAt: now
        )
        let content = ActivityContent(
            state: state,
            staleDate: Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)),
            relevanceScore: 1
        )

        let activities = Activity<DailyFinanceActivityAttributes>.activities
        if !forceRestart,
           let current = activities.first(where: { Calendar.current.isDateInToday($0.attributes.day) }) {
            await current.update(content)
            status = .active
            for obsolete in activities where obsolete.id != current.id {
                await obsolete.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        for obsolete in activities {
            await obsolete.end(nil, dismissalPolicy: .immediate)
        }

        guard UIApplication.shared.applicationState == .active else {
            status = .waitingForForeground
            return
        }

        do {
            status = .starting
            let activity = try Activity.request(
                attributes: DailyFinanceActivityAttributes(day: Calendar.current.startOfDay(for: now)),
                content: content,
                pushType: nil
            )
            status = activity.activityState == .active ? .active : .failed("ActivityKit: \(activity.activityState)")
        } catch {
            let nsError = error as NSError
            let details = "\(nsError.localizedDescription) [\(nsError.domain):\(nsError.code)]"
            status = .failed(details)
            print("Live Activity could not start: \(details)")
        }
    }
}
