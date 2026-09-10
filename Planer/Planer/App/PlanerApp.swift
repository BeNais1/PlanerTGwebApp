import SwiftUI

@main
@MainActor
struct PlanerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var authSession = AuthSession()
    @State private var pendingDeepLink: URL?

    var body: some Scene {
        WindowGroup {
            Group {
                #if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--ui-preview") { NativePreviewApp() }
                else { authenticationContent }
                #else
                authenticationContent
                #endif
            }
            .environment(authSession)
            .environment(\.locale, Locale(identifier: "uk_UA"))
            .onOpenURL { pendingDeepLink = $0 }
            .onReceive(NotificationCenter.default.publisher(for: .planerOpenURL)) { notification in
                pendingDeepLink = notification.object as? URL
            }
            .task {
                #if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--ui-preview") { return }
                #endif
                authSession.start()
            }
        }
    }
    @ViewBuilder private var authenticationContent: some View {
                switch authSession.state {
                case .loading:
                    ZStack {
                        AtmosphericBackground()
                        ProgressView("Перевіряємо вхід…")
                    }
                case .signedOut:
                    LoginView()
                case .signedIn(let user):
                    AuthenticatedAppView(user: user, pendingDeepLink: $pendingDeepLink)
                        .id(user.id)
                }
    }
}
