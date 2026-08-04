import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import Observation
import UIKit

struct AuthenticatedUser: Equatable, Identifiable {
    let id: String
    let displayName: String
    let email: String
    let photoURL: URL?
}

@MainActor
@Observable
final class AuthSession {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(AuthenticatedUser)
    }

    private(set) var state: State = .loading
    private(set) var isSigningIn = false
    var errorMessage: String?

    @ObservationIgnored private var listener: AuthStateDidChangeListenerHandle?

    static func preview() -> AuthSession {
        let session = AuthSession()
        session.state = .signedIn(
            AuthenticatedUser(
                id: "preview-user",
                displayName: "Boris",
                email: "boris@example.com",
                photoURL: nil
            )
        )
        return session
    }

    func start() {
        guard listener == nil else { return }
        listener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                if let user {
                    self.state = .signedIn(
                        AuthenticatedUser(
                            id: user.uid,
                            displayName: user.displayName ?? user.email ?? "Planer",
                            email: user.email ?? "",
                            photoURL: user.photoURL
                        )
                    )
                } else {
                    self.state = .signedOut
                }
            }
        }
    }

    func signInWithGoogle() async {
        guard !isSigningIn else { return }
        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            guard let clientID = FirebaseApp.app()?.options.clientID else {
                throw AuthSessionError.missingClientID
            }
            guard let presenter = Self.presentingViewController else {
                throw AuthSessionError.missingPresenter
            }

            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            let result = try await googleSignIn(presenting: presenter)
            guard let idToken = result.user.idToken?.tokenString else {
                throw AuthSessionError.missingIDToken
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            try await firebaseSignIn(with: credential)
        } catch let error as NSError where error.domain == kGIDSignInErrorDomain && error.code == -5 {
            return
        } catch {
            print("Google sign-in error: \(error)")
            errorMessage = Self.userFacingMessage(for: error)
        }
    }

    func signOut() {
        errorMessage = nil
        do {
            try Auth.auth().signOut()
            GIDSignIn.sharedInstance.signOut()
        } catch {
            print("Sign-out error: \(error)")
            errorMessage = "Не вдалося вийти з облікового запису. Спробуйте ще раз."
        }
    }

    private func googleSignIn(presenting viewController: UIViewController) async throws -> GIDSignInResult {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<GIDSignInResult, Error>) in
            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let result {
                    continuation.resume(returning: result)
                } else {
                    continuation.resume(throwing: AuthSessionError.missingGoogleResult)
                }
            }
        }
    }

    private func firebaseSignIn(with credential: AuthCredential) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Auth.auth().signIn(with: credential) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    private static var presentingViewController: UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController

        var presenter = root
        while let presented = presenter?.presentedViewController {
            presenter = presented
        }
        return presenter
    }

    private static func userFacingMessage(for error: Error) -> String {
        if let authError = error as? AuthSessionError {
            return authError.errorDescription ?? "Не вдалося увійти через Google."
        }
        return "Не вдалося увійти через Google. Перевірте інтернет-з’єднання та спробуйте ще раз."
    }
}

private enum AuthSessionError: LocalizedError {
    case missingClientID
    case missingPresenter
    case missingIDToken
    case missingGoogleResult

    var errorDescription: String? {
        switch self {
        case .missingClientID:
            "У конфігурації Firebase не знайдено Google Client ID."
        case .missingPresenter:
            "Не вдалося відкрити вікно входу Google."
        case .missingIDToken:
            "Google не повернув токен ідентифікації."
        case .missingGoogleResult:
            "Вхід через Google завершився без результату."
        }
    }
}
