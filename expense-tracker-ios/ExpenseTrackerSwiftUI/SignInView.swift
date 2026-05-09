import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthViewModel

    var body: some View {
        ZStack {
            AppBackground()

            VStack(spacing: 22) {
                VStack(spacing: 10) {
                    Text("Expense Tracker")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Sign in with Google and sync data with Firebase")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                }

                Button {
                    auth.signInWithGoogle()
                } label: {
                    HStack(spacing: 10) {
                        if auth.isSigningIn {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                        } else {
                            Image(systemName: "globe")
                                .font(.headline)
                        }

                        Text(auth.isSigningIn ? "Connecting..." : "Continue with Google")
                            .font(.headline.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
                .liquidGlass(interactive: true, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .disabled(auth.isSigningIn)

                if !auth.errorMessage.isEmpty {
                    Text(auth.errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red.opacity(0.95))
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .frame(maxWidth: 420)
        }
    }
}
