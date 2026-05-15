import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthViewModel
    @State private var iconPulse = false

    var body: some View {
        ZStack {
            AppBackground(palette: .auroraNight)

            VStack(spacing: 28) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(Theme.Gradient.accentGlow)
                        .frame(width: 120, height: 120)
                        .blur(radius: 40)
                        .opacity(0.8)

                    Circle()
                        .fill(.white.opacity(0.06))
                        .frame(width: 110, height: 110)
                        .overlay(
                            Circle().stroke(.white.opacity(0.18), lineWidth: 1)
                        )

                    Image(systemName: "wallet.bifold.fill")
                        .font(.system(size: 48, weight: .semibold))
                        .foregroundStyle(.white)
                        .scaleEffect(iconPulse ? 1.05 : 1.0)
                }
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true)) {
                        iconPulse = true
                    }
                }

                VStack(spacing: 10) {
                    Text("Гаманець")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Особистий фінансовий помічник\nз синхронізацією в Firebase")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Palette.secondaryText)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                VStack(spacing: 14) {
                    Button {
                        auth.signInWithGoogle()
                    } label: {
                        HStack(spacing: 10) {
                            if auth.isSigningIn {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.white)
                            } else {
                                Image(systemName: "g.circle.fill")
                                    .font(.system(size: 20, weight: .bold))
                            }

                            Text(auth.isSigningIn ? "З'єднання…" : "Увійти через Google")
                                .font(Theme.Typography.headline)
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                    }
                    .buttonStyle(.plain)
                    .background(Theme.Gradient.primaryButton)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.pill, style: .continuous))
                    .shadow(color: Theme.Palette.indigo.opacity(0.55), radius: 18, x: 0, y: 8)
                    .disabled(auth.isSigningIn)

                    if !auth.errorMessage.isEmpty {
                        Text(auth.errorMessage)
                            .font(Theme.Typography.footnote)
                            .foregroundStyle(Theme.Palette.rose)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                    }

                    Text("Натискаючи, ви приймаєте умови використання")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                        .multilineTextAlignment(.center)
                }
                .padding(.bottom, 24)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: 460)
        }
    }
}
