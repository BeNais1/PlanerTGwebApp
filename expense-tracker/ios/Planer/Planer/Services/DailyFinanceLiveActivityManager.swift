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

    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    @ObservationIgnored private var stateTask: Task<Void, Never>?
    @ObservationIgnored private var observedActivityID: String?

    private init() {}

    func refresh(with snapshot: DailyFinanceSnapshot, forceRestart: Bool = false) async {
        // MainActor is reentrant at update/end awaits. Serialize the entire operation
        // so a foreground refresh and a manual restart cannot create two activities.
        let previous = refreshTask
        let task = Task { @MainActor in
            await previous?.value
            await self.performRefresh(with: snapshot, forceRestart: forceRestart)
        }
        refreshTask = task
        await task.value
    }

    private func performRefresh(with snapshot: DailyFinanceSnapshot, forceRestart: Bool) async {
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
           let current = activities.first(where: {
               Self.canReuse(state: $0.activityState, day: $0.attributes.day, now: now)
           }) {
            await current.update(content)
            observe(current)
            updateStatus(current.activityState)
            for obsolete in activities where obsolete.id != current.id {
                await obsolete.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        // Keep the existing card if iOS cannot start its replacement yet.
        guard UIApplication.shared.applicationState == .active else {
            status = .waitingForForeground
            return
        }

        stateTask?.cancel()
        observedActivityID = nil
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
            observe(activity)
            updateStatus(activity.activityState)
        } catch {
            let nsError = error as NSError
            let details = "\(nsError.localizedDescription) [\(nsError.domain):\(nsError.code)]"
            status = .failed(details)
            print("Live Activity could not start: \(details)")
        }
    }

    static func canReuse(state: ActivityState, day: Date, now: Date, calendar: Calendar = .current) -> Bool {
        (state == .active || state == .stale) && calendar.isDate(day, inSameDayAs: now)
    }

    private func observe(_ activity: Activity<DailyFinanceActivityAttributes>) {
        guard observedActivityID != activity.id else { return }
        stateTask?.cancel()
        observedActivityID = activity.id
        stateTask = Task { @MainActor [weak self] in
            for await state in activity.activityStateUpdates {
                guard !Task.isCancelled, let self,
                      self.observedActivityID == activity.id else { return }
                self.updateStatus(state)
            }
        }
    }

    private func updateStatus(_ state: ActivityState) {
        switch state {
        case .active: status = .active
        case .stale, .ended, .dismissed: status = .waitingForForeground
        @unknown default: status = .checking
        }
    }

}
