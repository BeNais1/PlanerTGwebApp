import Foundation
import Observation

@MainActor
@Observable
final class AppOnboardingStore {
    private(set) var shouldPresent: Bool
    @ObservationIgnored private let completionKey: String

    init(userID: String) {
        completionKey = "planer.onboarding.completed.v1.\(userID)"
        shouldPresent = !UserDefaults.standard.bool(forKey: completionKey)
    }

    func present() {
        shouldPresent = true
    }

    func complete() {
        UserDefaults.standard.set(true, forKey: completionKey)
        shouldPresent = false
    }

    func resetAfterDataRemoval() {
        UserDefaults.standard.removeObject(forKey: completionKey)
        shouldPresent = true
    }
}
