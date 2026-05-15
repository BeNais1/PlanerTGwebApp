import SwiftUI

enum OnboardingStep: Int, CaseIterable, Identifiable {
    case welcome
    case gender
    case age
    case married
    case pets
    case currency
    case ready

    var id: Int { rawValue }
}

struct OnboardingFlow: View {
    @EnvironmentObject private var store: AppStore
    @State private var step: OnboardingStep = .welcome
    @State private var gender: Gender?
    @State private var age: Int = 25
    @State private var isMarried: Bool?
    @State private var hasPets: Bool?
    @State private var mainCurrency: CurrencyCode = .eur

    var body: some View {
        ZStack {
            AppBackground(palette: paletteForStep)
                .animation(.easeInOut(duration: 0.8), value: step)

            VStack(spacing: 16) {
                progressBar
                    .padding(.horizontal, 18)
                    .padding(.top, 8)

                TabView(selection: $step) {
                    welcomeStep.tag(OnboardingStep.welcome)
                    genderStep.tag(OnboardingStep.gender)
                    ageStep.tag(OnboardingStep.age)
                    marriedStep.tag(OnboardingStep.married)
                    petsStep.tag(OnboardingStep.pets)
                    currencyStep.tag(OnboardingStep.currency)
                    readyStep.tag(OnboardingStep.ready)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(Theme.Motion.smooth, value: step)

                navigationButtons
                    .padding(.horizontal, 18)
                    .padding(.bottom, 18)
            }
        }
    }

    private var paletteForStep: MeshPalette {
        switch step {
        case .welcome, .ready: return .auroraNight
        case .gender, .age: return .sunsetPeach
        case .married, .pets: return .oceanDeep
        case .currency: return .auroraNight
        }
    }

    private var progressBar: some View {
        HStack(spacing: 6) {
            ForEach(OnboardingStep.allCases) { s in
                Capsule()
                    .fill(s.rawValue <= step.rawValue ? Color.white : Color.white.opacity(0.18))
                    .frame(height: 4)
                    .animation(Theme.Motion.snappy, value: step)
            }
        }
    }

    private var welcomeStep: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.Gradient.accentGlow)
                    .frame(width: 140, height: 140)
                    .blur(radius: 50)
                Image(systemName: "sparkles")
                    .font(.system(size: 64))
                    .foregroundStyle(.white)
            }
            Text("Ласкаво просимо")
                .font(Theme.Typography.display)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("Розкажіть трохи про себе —\nми зробимо застосунок зручнішим")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Palette.secondaryText)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private var genderStep: some View {
        stepScaffold(title: "Ваша стать", subtitle: "Це допоможе персоналізувати інтерфейс") {
            VStack(spacing: 12) {
                ForEach(Gender.allCases) { g in
                    optionRow(
                        title: g.title,
                        icon: g.icon,
                        selected: gender == g
                    ) {
                        gender = g
                    }
                }
            }
        }
    }

    private var ageStep: some View {
        stepScaffold(title: "Скільки вам років?", subtitle: "") {
            VStack(spacing: 20) {
                Text("\(age)")
                    .font(.system(size: 80, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(Theme.Motion.snappy, value: age)

                HStack(spacing: 12) {
                    GlassIconButton(systemImage: "minus") {
                        if age > 10 { age -= 1 }
                    }
                    Slider(value: Binding(
                        get: { Double(age) },
                        set: { age = Int($0) }
                    ), in: 10...90, step: 1)
                    .tint(Theme.Palette.indigo)
                    GlassIconButton(systemImage: "plus") {
                        if age < 90 { age += 1 }
                    }
                }
            }
        }
    }

    private var marriedStep: some View {
        stepScaffold(title: "Сімейний стан?", subtitle: "") {
            VStack(spacing: 12) {
                optionRow(title: "У шлюбі", icon: "heart.fill", selected: isMarried == true) {
                    isMarried = true
                }
                optionRow(title: "Самотній", icon: "person.fill", selected: isMarried == false) {
                    isMarried = false
                }
            }
        }
    }

    private var petsStep: some View {
        stepScaffold(title: "Є домашні улюбленці?", subtitle: "") {
            VStack(spacing: 12) {
                optionRow(title: "Так, є", icon: "pawprint.fill", selected: hasPets == true) {
                    hasPets = true
                }
                optionRow(title: "Поки немає", icon: "leaf.fill", selected: hasPets == false) {
                    hasPets = false
                }
            }
        }
    }

    private var currencyStep: some View {
        stepScaffold(title: "Основна валюта", subtitle: "Решта валют будуть конвертуватися сюди") {
            VStack(spacing: 12) {
                ForEach(CurrencyCode.allCases) { code in
                    optionRow(
                        title: "\(code.defaultWalletName) (\(code.symbol))",
                        icon: "creditcard.fill",
                        selected: mainCurrency == code
                    ) {
                        mainCurrency = code
                    }
                }
            }
        }
    }

    private var readyStep: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Theme.Palette.mint.opacity(0.4))
                    .frame(width: 140, height: 140)
                    .blur(radius: 40)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(Theme.Palette.mint)
            }
            Text("Усе готово!")
                .font(Theme.Typography.display)
                .foregroundStyle(.white)
            Text("Ваш фінансовий помічник\nготовий до роботи")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Palette.secondaryText)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func stepScaffold<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 18) {
            Spacer()
            VStack(spacing: 8) {
                Text(title)
                    .font(Theme.Typography.title)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Palette.secondaryText)
                        .multilineTextAlignment(.center)
                }
            }
            content()
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func optionRow(title: String, icon: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            HapticFeedback.selection()
            withAnimation(Theme.Motion.snappy) {
                action()
            }
        } label: {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(selected ? .white : Theme.Palette.indigo)
                    .frame(width: 32)
                Text(title)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.Palette.mint)
                }
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .liquidGlass(
            tint: selected ? Theme.Palette.indigo.opacity(0.3) : .white.opacity(0.04),
            interactive: true,
            in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .stroke(selected ? Theme.Palette.indigo.opacity(0.6) : .clear, lineWidth: 1)
        )
    }

    private var navigationButtons: some View {
        HStack(spacing: 10) {
            if step != .welcome {
                Button {
                    HapticFeedback.tap()
                    withAnimation(Theme.Motion.smooth) {
                        if let prev = OnboardingStep(rawValue: step.rawValue - 1) {
                            step = prev
                        }
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                }
                .buttonStyle(.plain)
                .liquidGlass(tint: .white.opacity(0.08), interactive: true, in: Circle())
            }

            Button {
                HapticFeedback.tap()
                advance()
            } label: {
                HStack(spacing: 6) {
                    Text(step == .ready ? "Розпочати" : "Далі")
                    if step != .ready {
                        Image(systemName: "chevron.right")
                    }
                }
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
                .background(Theme.Gradient.primaryButton)
                .clipShape(Capsule())
                .shadow(color: Theme.Palette.indigo.opacity(0.5), radius: 16, x: 0, y: 6)
            }
            .buttonStyle(.plain)
        }
    }

    private func advance() {
        if step == .ready {
            finish()
            return
        }
        withAnimation(Theme.Motion.smooth) {
            if let next = OnboardingStep(rawValue: step.rawValue + 1) {
                step = next
            }
        }
    }

    private func finish() {
        HapticFeedback.success()
        store.settings.mainCurrency = mainCurrency
        store.completeOnboarding(gender: gender, age: age, isMarried: isMarried, hasPets: hasPets)
    }
}
