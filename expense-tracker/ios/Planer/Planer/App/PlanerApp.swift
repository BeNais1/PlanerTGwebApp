import SwiftUI

@main
@MainActor
struct PlanerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var authSession = AuthSession()

    var body: some Scene {
        WindowGroup {
            Group {
                switch authSession.state {
                case .loading:
                    ZStack {
                        AtmosphericBackground()
                        ProgressView("Перевіряємо вхід…")
                    }
                case .signedOut:
                    LoginView()
                case .signedIn(let user):
                    AuthenticatedAppView(user: user)
                        .id(user.id)
                }
            }
            .environment(authSession)
            .environment(\.locale, Locale(identifier: "uk_UA"))
            .task {
                authSession.start()
            }
        }
    }
}
