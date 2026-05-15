import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var budgetText: String = ""
    @State private var showingCategoriesManager = false
    @State private var showingWalletsManager = false

    var body: some View {
        ZStack {
            AppBackground(palette: .auroraNight)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    header

                    accountCard

                    sectionTitle("Валюта та гаманці")
                    currencyCard
                    walletsButton

                    sectionTitle("Бюджет")
                    budgetCard

                    sectionTitle("Категорії")
                    categoriesButton

                    sectionTitle("Акаунт")
                    signOutButton

                    Color.clear.frame(height: 40)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
        }
        .onAppear {
            budgetText = String(format: "%.2f", store.settings.budgetLimit)
        }
        .sheet(isPresented: $showingCategoriesManager) {
            CategoriesManagerView()
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationBackground(.clear)
        }
        .sheet(isPresented: $showingWalletsManager) {
            WalletsManagerView()
                .environmentObject(store)
                .presentationDetents([.medium, .large])
                .presentationBackground(.clear)
        }
    }

    private var header: some View {
        HStack {
            Text("Налаштування")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(.white)
            Spacer()
            GlassIconButton(systemImage: "xmark") {
                dismiss()
            }
        }
        .padding(.top, 6)
    }

    private var accountCard: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 16, tint: Theme.Palette.indigo.opacity(0.16)) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Theme.Gradient.accentGlow)
                        .frame(width: 52, height: 52)
                    Text(initials)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(auth.user?.displayName ?? "Користувач")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    Text(auth.user?.email ?? "")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title.uppercased())
            .font(Theme.Typography.caption.weight(.bold))
            .tracking(1.2)
            .foregroundStyle(Theme.Palette.tertiaryText)
            .padding(.horizontal, 4)
            .padding(.top, 6)
    }

    private var currencyCard: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Основна валюта")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                HStack(spacing: 8) {
                    ForEach(CurrencyCode.allCases) { code in
                        GlassChip(
                            title: "\(code.symbol) \(code.rawValue)",
                            isSelected: store.settings.mainCurrency == code,
                            tint: code.accent
                        ) {
                            store.settings.mainCurrency = code
                        }
                    }
                    Spacer()
                }
            }
        }
    }

    private var walletsButton: some View {
        Button {
            showingWalletsManager = true
        } label: {
            HStack {
                Image(systemName: "wallet.pass.fill")
                    .foregroundStyle(Theme.Palette.cyan)
                Text("Назви гаманців")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.Palette.tertiaryText)
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }

    private var budgetCard: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 16) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Ліміт")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                    Spacer()
                    Text(store.settings.mainCurrency.symbol)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    TextField("0", text: $budgetText)
                        .font(Theme.Typography.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 110)
                        .onChange(of: budgetText) { _, newValue in
                            if let v = Double(newValue.replacingOccurrences(of: ",", with: ".")) {
                                store.settings.budgetLimit = v
                            }
                        }
                }
                Divider().background(Color.white.opacity(0.08))
                HStack(spacing: 8) {
                    Text("Період:")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                    Spacer()
                    ForEach(BudgetPeriod.allCases) { p in
                        GlassChip(title: p.title, isSelected: store.settings.budgetPeriod == p) {
                            store.settings.budgetPeriod = p
                        }
                    }
                }
            }
        }
    }

    private var categoriesButton: some View {
        Button {
            showingCategoriesManager = true
        } label: {
            HStack {
                Image(systemName: "tag.fill")
                    .foregroundStyle(Theme.Palette.amber)
                Text("Керування категоріями")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.Palette.tertiaryText)
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }

    private var signOutButton: some View {
        Button {
            HapticFeedback.warning()
            auth.signOut()
            dismiss()
        } label: {
            HStack {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Вийти з Google")
                    .font(Theme.Typography.callout.weight(.semibold))
                Spacer()
            }
            .foregroundStyle(Theme.Palette.rose)
            .padding(16)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: Theme.Palette.rose.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }

    private var initials: String {
        let name = auth.user?.displayName ?? auth.user?.email ?? "U"
        let parts = name.split(separator: " ")
        if let first = parts.first?.first {
            if parts.count > 1, let last = parts.last?.first {
                return "\(first)\(last)".uppercased()
            }
            return String(first).uppercased()
        }
        return "U"
    }
}

struct WalletsManagerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var drafts: [String: String] = [:]

    var body: some View {
        ZStack {
            AppBackground(palette: .oceanDeep)

            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Назви гаманців")
                        .font(Theme.Typography.title)
                        .foregroundStyle(.white)
                    Spacer()
                    GlassIconButton(systemImage: "xmark") { dismiss() }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)

                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(CurrencyCode.allCases) { code in
                            walletRow(code: code)
                        }
                    }
                    .padding(.horizontal, 18)
                }
            }
        }
        .onAppear {
            for code in CurrencyCode.allCases {
                drafts[code.rawValue] = store.walletName(for: code)
            }
        }
    }

    private func walletRow(code: CurrencyCode) -> some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: code.accent.opacity(0.12)) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(code.accent.opacity(0.3))
                        .frame(width: 44, height: 44)
                    Text(code.symbol)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(code.rawValue)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    TextField(code.defaultWalletName, text: Binding(
                        get: { drafts[code.rawValue] ?? "" },
                        set: { newValue in
                            drafts[code.rawValue] = newValue
                            store.renameWallet(currency: code, name: newValue)
                        }
                    ))
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                    .tint(code.accent)
                }
            }
        }
    }
}

struct CategoriesManagerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            AppBackground(palette: .sunsetPeach)

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Категорії")
                        .font(Theme.Typography.title)
                        .foregroundStyle(.white)
                    Spacer()
                    GlassIconButton(systemImage: "xmark") { dismiss() }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)

                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(defaultExpenseCategories) { cat in
                            categoryRow(cat)
                        }
                    }
                    .padding(.horizontal, 18)
                }
            }
        }
    }

    private func categoryRow(_ cat: Category) -> some View {
        let hidden = store.settings.hiddenCategoryIds.contains(cat.id)
        return HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(cat.color.opacity(hidden ? 0.1 : 0.25))
                    .frame(width: 40, height: 40)
                Image(systemName: cat.symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(hidden ? Theme.Palette.tertiaryText : cat.color)
            }
            Text(cat.title)
                .font(Theme.Typography.callout)
                .foregroundStyle(hidden ? Theme.Palette.tertiaryText : .white)
                .strikethrough(hidden)
            Spacer()
            Button {
                HapticFeedback.selection()
                store.toggleCategoryHidden(cat)
            } label: {
                Image(systemName: hidden ? "eye.slash.fill" : "eye.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(hidden ? Theme.Palette.tertiaryText : Theme.Palette.indigo)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }
}
