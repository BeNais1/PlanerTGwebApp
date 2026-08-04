import FirebaseCore
import GoogleSignIn
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        GIDSignIn.sharedInstance.configure(completion: nil)
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
}

extension Notification.Name {
    static let planerOpenURL = Notification.Name("planer.open-url")
}
