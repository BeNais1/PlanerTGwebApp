import SwiftUI

private struct OnboardingPage: Identifiable {
    let id: Int
    let title: String
    let text: String
    let systemImage: String
    let color: Color
}

struct WelcomeOnboardingView: View {
    @Environment(AppOnboardingStore.self) private var onboarding
    @State private var page = 0

    private let pages = [
        OnboardingPage(
            id: 0,
            title: "Ваші фінанси в одному місці",
            text: "Додавайте картки, доходи, витрати й перекази. Planer зберігає зміни на телефоні навіть без інтернету.",
            systemImage: "wallet.bifold.fill",
            color: PlanerTheme.accent
        ),
        OnboardingPage(
            id: 1,
            title: "Спільний сімейний бюджет",
            text: "Запросіть близьких, керуйте правами й отримуйте сповіщення про нові сімейні операції.",
            systemImage: "person.3.fill",
            color: PlanerTheme.positive
        ),
        OnboardingPage(
            id: 2,
            title: "Кредити без пропущених дат",
            text: "Створіть графік платежів, оберіть картку та вирішуйте окремо, чи списувати з неї кожний платіж.",
            systemImage: "creditcard.trianglebadge.exclamationmark",
            color: PlanerTheme.warning
        ),
        OnboardingPage(
            id: 3,
            title: "Готово до роботи",
            text: "Увімкніть сповіщення, щоб отримувати термінові нагадування про кредитні платежі й події сімейного акаунта.",
            systemImage: "bell.badge.fill",
            color: PlanerTheme.accent
        )
    ]

    var body: some View {
        ZStack {
            AtmosphericBackground()
            VStack(spacing: 22) {
                HStack {
                    Spacer()
                    if page < pages.count - 1 {
                        Button("Пропустити") { onboarding.complete() }
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 20)

                TabView(selection: $page) {
                    ForEach(pages) { item in
                        VStack(spacing: 24) {
                            Image(systemName: item.systemImage)
                                .font(.system(size: 62, weight: .semibold))
                                .foregroundStyle(item.color)
                                .frame(width: 132, height: 132)
                                .background(item.color.opacity(0.14), in: RoundedRectangle(cornerRadius: 34))
                            VStack(spacing: 12) {
                                Text(item.title)
                                    .font(.largeTitle.bold())
                                    .multilineTextAlignment(.center)
                                Text(item.text)
                                    .font(.body)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(4)
                            }
                            .padding(.horizontal, 26)
                        }
                        .tag(item.id)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))

                Button(page == pages.count - 1 ? "Почати" : "Далі") {
                    if page == pages.count - 1 {
                        onboarding.complete()
                    } else {
                        withAnimation { page += 1 }
                    }
                }
                .frame(maxWidth: .infinity)
                .planerProminentButton()
                .padding(.horizontal, 22)
                .padding(.bottom, 18)
            }
            .padding(.top, 18)
        }
        .interactiveDismissDisabled()
    }
}
