import SwiftUI
import GoogleSignIn

@main
struct ExpenseTrackerSwiftUIApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var auth = AuthViewModel()

    init() {
        FirebaseBootstrap.configureIfNeeded()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(auth)
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
