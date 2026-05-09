import Foundation
import FirebaseAuth
import GoogleSignIn
import UIKit

final class AuthViewModel: ObservableObject {
    @Published private(set) var user: User?
    @Published var isSigningIn = false
    @Published var errorMessage = ""

    private var authStateListener: AuthStateDidChangeListenerHandle?

    init() {
        FirebaseBootstrap.configureIfNeeded()
        user = Auth.auth().currentUser
        authStateListener = Auth.auth().addStateDidChangeListener { [weak self] _, nextUser in
            DispatchQueue.main.async {
                self?.user = nextUser
            }
        }
    }

    deinit {
        if let authStateListener {
            Auth.auth().removeStateDidChangeListener(authStateListener)
        }
    }

    func signInWithGoogle() {
        guard !isSigningIn else { return }

        let clientID = FirebaseBootstrap.googleClientID()
        let reversedClientID = FirebaseBootstrap.reversedClientID()

        guard !clientID.isEmpty else {
            errorMessage = "Google Client ID is missing. Set GOOGLE_CLIENT_ID in Info.plist."
            return
        }

        guard !reversedClientID.isEmpty else {
            errorMessage = "Reversed Client ID is missing. Set REVERSED_CLIENT_ID in Info.plist."
            return
        }

        guard let presentingController = topViewController() else {
            errorMessage = "Cannot open the Google sign-in screen."
            return
        }

        errorMessage = ""
        isSigningIn = true

        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        GIDSignIn.sharedInstance.signIn(withPresenting: presentingController) { [weak self] result, error in
            guard let self else { return }

            if let error {
                DispatchQueue.main.async {
                    self.isSigningIn = false
                    self.errorMessage = "Google Sign-In failed: \(error.localizedDescription)"
                }
                return
            }

            guard let googleUser = result?.user,
                  let idToken = googleUser.idToken?.tokenString else {
                DispatchQueue.main.async {
                    self.isSigningIn = false
                    self.errorMessage = "Google did not return an auth token."
                }
                return
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: googleUser.accessToken.tokenString
            )

            Auth.auth().signIn(with: credential) { _, signInError in
                DispatchQueue.main.async {
                    self.isSigningIn = false
                    if let signInError {
                        self.errorMessage = "Firebase Auth failed: \(signInError.localizedDescription)"
                    }
                }
            }
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            GIDSignIn.sharedInstance.signOut()
        } catch {
            errorMessage = "Sign out failed: \(error.localizedDescription)"
        }
    }

    private func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow = scenes
            .flatMap { $0.windows }
            .first(where: \.isKeyWindow)

        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
