import Foundation
import FirebaseCore

enum FirebaseClientConfig {
    static let googleAppID = "1:961873874615:ios:cf80b47bfea9e9da91c732"
    static let gcmSenderID = "961873874615"
    static let apiKey = "AIzaSyA4kw1-3ge6b9XFZOhQam_WfkJ1AxF4UrA"
    static let projectID = "planer-app-3a0f2"
    static let databaseURL = "https://planer-app-3a0f2-default-rtdb.europe-west1.firebasedatabase.app"
    static let storageBucket = "planer-app-3a0f2.firebasestorage.app"
    static let defaultClientID = "961873874615-aou9tmmfarru9l3cr48q8hmbtv9n910f.apps.googleusercontent.com"
    static let defaultReversedClientID = "com.googleusercontent.apps.961873874615-aou9tmmfarru9l3cr48q8hmbtv9n910f"
}

enum FirebaseBootstrap {
    static func configureIfNeeded() {
        guard FirebaseApp.app() == nil else { return }

        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            return
        }

        let options = FirebaseOptions(googleAppID: FirebaseClientConfig.googleAppID, gcmSenderID: FirebaseClientConfig.gcmSenderID)
        options.apiKey = FirebaseClientConfig.apiKey
        options.projectID = FirebaseClientConfig.projectID
        options.databaseURL = FirebaseClientConfig.databaseURL
        options.storageBucket = FirebaseClientConfig.storageBucket
        options.bundleID = Bundle.main.bundleIdentifier
        options.clientID = googleClientID()

        FirebaseApp.configure(options: options)
    }

    static func googleClientID() -> String {
        readNonEmptyInfoValue("GOOGLE_CLIENT_ID", fallback: FirebaseClientConfig.defaultClientID)
    }

    static func reversedClientID() -> String {
        readNonEmptyInfoValue("REVERSED_CLIENT_ID", fallback: FirebaseClientConfig.defaultReversedClientID)
    }

    private static func readNonEmptyInfoValue(_ key: String, fallback: String) -> String {
        if let configured = Bundle.main.object(forInfoDictionaryKey: key) as? String {
            let trimmed = configured.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }
        return fallback.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
