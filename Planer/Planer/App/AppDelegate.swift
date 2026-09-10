import FirebaseCore
import FirebaseDatabase
import GoogleSignIn
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        Database.database().isPersistenceEnabled = true
        GIDSignIn.sharedInstance.configure(completion: nil)
        UNUserNotificationCenter.current().delegate = self
        PlanerNotificationService.registerCategories()
        return true
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        if url.scheme == "planer" {
            NotificationCenter.default.post(name: .planerOpenURL, object: url)
            return true
        }
        return GIDSignIn.sharedInstance.handle(url)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let urlString: String?
        switch response.actionIdentifier {
        case PlanerNotificationService.addExpenseAction:
            urlString = "planer://transaction/expense"
        case PlanerNotificationService.addIncomeAction:
            urlString = "planer://transaction/income"
        default:
            urlString = response.notification.request.content.userInfo["url"] as? String
        }
        guard let urlString, let url = URL(string: urlString) else { return }
        NotificationCenter.default.post(name: .planerOpenURL, object: url)
    }
}

extension Notification.Name {
    static let planerOpenURL = Notification.Name("planer.open-url")
}
