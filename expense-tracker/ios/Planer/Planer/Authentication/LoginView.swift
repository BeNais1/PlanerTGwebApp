import SwiftUI

struct LoginView: View {
    @Environment(AuthSession.self) private var authSession

    var body: some View {
        ZStack {
            AtmosphericBackground()

            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 18) {
                    Image(systemName: "chart.pie.fill")
                        .font(.system(size: 42, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 86, height: 86)
                        .background(PlanerTheme.accent.gradient, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                        .shadow(color: PlanerTheme.accent.opacity(0.35), radius: 24, y: 12)

                    VStack(spacing: 8) {
                        Text("Planer")
                            .font(.largeTitle.bold())
                        Text("Ваши финансы синхронизируются через Firebase и доступны после входа в Google.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }

                Spacer()

                Button {
                    Task { await authSession.signInWithGoogle() }
                } label: {
                    HStack(spacing: 12) {
                        if authSession.isSigningIn {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("G")
                                .font(.headline.bold())
                                .frame(width: 28, height: 28)
                                .background(.white, in: Circle())
                                .foregroundStyle(.blue)
                        }
                        Text(authSession.isSigningIn ? "Входим…" : "Продолжить с Google")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                }
                .disabled(authSession.isSigningIn)
                .planerProminentButton()
                .accessibilityIdentifier("googleSignInButton")

                Text("При первом входе приложение начнётся с чистого листа.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 36)
        }
        .alert("Не удалось войти", isPresented: errorBinding) {
            Button("OK", role: .cancel) { authSession.errorMessage = nil }
        } message: {
            Text(authSession.errorMessage ?? "Попробуйте ещё раз.")
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { authSession.errorMessage != nil },
            set: { if !$0 { authSession.errorMessage = nil } }
        )
    }
}

#Preview("Google Sign-In") {
    LoginView()
        .environment(AuthSession())
        .preferredColorScheme(.dark)
}
