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
                        ProgressView("Проверяем вход…")
                    }
                case .signedOut:
                    LoginView()
                case .signedIn(let user):
                    AuthenticatedAppView(user: user)
                        .id(user.id)
                }
            }
            .environment(authSession)
            .task {
                authSession.start()
            }
        }
    }
}
