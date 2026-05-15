import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore
    @Binding var showingAddSheet: Bool
    @State private var showingSettings = false
    @State private var selectedCurrency: CurrencyCode = .eur
    @State private var animateBalance: Double = 0

    private var budgetProgress: Double {
        guard store.settings.budgetLimit > 0 else { return 0 }
        return min(store.periodExpenses / store.settings.budgetLimit, 1)
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                header
                balanceHero
                walletCarousel
                budgetCard
                quickActions
                todaySection
                Color.clear.frame(height: 80)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollContentBackground(.hidden)
        .onAppear {
            selectedCurrency = store.settings.mainCurrency
            withAnimation(Theme.Motion.smooth.delay(0.1)) {
                animateBalance = store.balance(for: selectedCurrency)
            }
        }
        .onChange(of: selectedCurrency) { _, newValue in
            withAnimation(Theme.Motion.smooth) {
                animateBalance = store.balance(for: newValue)
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(.clear)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(AppLocale.monthYearFormatter.string(from: Date()).capitalized)
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Text("Привіт 👋")
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(Theme.Palette.primaryText)
            }
            Spacer()
            GlassIconButton(systemImage: "gearshape.fill") {
                showingSettings = true
            }
        }
        .padding(.top, 4)
    }

    private var balanceHero: some View {
        GlassCard(cornerRadius: Theme.Radius.xxl, padding: 24, tint: Theme.Palette.indigo.opacity(0.18)) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .bold))
                    Text("Загальний баланс")
                        .font(Theme.Typography.footnote)
                }
                .foregroundStyle(Theme.Palette.secondaryText)

                Text(store.formatted(store.currentBalance))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .animation(Theme.Motion.smooth, value: store.currentBalance)

                HStack(spacing: 10) {
                    MetricPill(
                        title: "Витрати",
                        value: store.formatted(store.periodExpenses),
                        symbol: "arrow.up.right",
                        tint: Theme.Palette.expense
                    )
                    MetricPill(
                        title: "Доходи",
                        value: store.formatted(store.periodIncome),
                        symbol: "arrow.down.left",
                        tint: Theme.Palette.income
                    )
                }
            }
        }
    }

    private var walletCarousel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Гаманці")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Palette.primaryText)
                Spacer()
            }
            .padding(.horizontal, 4)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(store.settings.enabledCurrencies) { currency in
                        WalletCard(
                            currency: currency,
                            name: store.walletName(for: currency),
                            balance: store.balance(for: currency),
                            selected: currency == selectedCurrency
                        )
                        .onTapGesture {
                            HapticFeedback.selection()
                            withAnimation(Theme.Motion.snappy) {
                                selectedCurrency = currency
                            }
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
        }
    }

    private var budgetCard: some View {
        GlassCard(cornerRadius: Theme.Radius.xl, padding: 18) {
            HStack(spacing: 18) {
                BudgetBubble(progress: budgetProgress)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Ліміт \(store.settings.budgetPeriod.subtitle)")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    Text("Залишок: \(store.formatted(max(store.settings.budgetLimit - store.periodExpenses, 0)))")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.secondaryText)
                    Text("Ліміт \(store.formatted(store.settings.budgetLimit))")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }

                Spacer(minLength: 0)
            }
        }
    }

    private var quickActions: some View {
        HStack(spacing: 10) {
            ActionButton(title: "Витрата", systemImage: "minus", tint: Theme.Palette.rose) {
                showingAddSheet = true
            }
            ActionButton(title: "Дохід", systemImage: "plus", tint: Theme.Palette.mint) {
                showingAddSheet = true
            }
            ActionButton(title: "Чек", systemImage: "qrcode.viewfinder", tint: Theme.Palette.cyan) {
                store.addReceipt(title: "Новий чек", merchant: "Збережено вручну", amount: 0, currency: store.settings.mainCurrency)
            }
        }
    }

    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Сьогодні")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(.white)
                Spacer()
                if !store.todayTransactions.isEmpty {
                    Text("\(store.todayTransactions.count)")
                        .font(Theme.Typography.footnote.weight(.bold))
                        .foregroundStyle(Theme.Palette.secondaryText)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .liquidGlass(tint: .white.opacity(0.06), in: Capsule())
                }
            }
            .padding(.horizontal, 4)

            if store.todayTransactions.isEmpty {
                EmptyStateCard(
                    icon: "tray",
                    title: "Поки що пусто",
                    subtitle: "Додайте першу транзакцію за день"
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(store.todayTransactions) { item in
                        TransactionRow(item: item)
                    }
                }
            }
        }
    }
}

struct MetricPill: View {
    let title: String
    let value: String
    let symbol: String
    var tint: Color = Theme.Palette.indigo

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(tint.opacity(0.22))
                    .frame(width: 30, height: 30)
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(tint)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Text(value)
                    .font(Theme.Typography.footnote.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }
}

struct ActionButton: View {
    let title: String
    let systemImage: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button {
            HapticFeedback.tap()
            action()
        } label: {
            VStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(tint.opacity(0.25))
                        .frame(width: 42, height: 42)
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(tint)
                }
                Text(title)
                    .font(Theme.Typography.footnote.weight(.semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: tint.opacity(0.1), interactive: true, in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }
}

struct WalletCard: View {
    let currency: CurrencyCode
    let name: String
    let balance: Double
    let selected: Bool

    private var formatter: NumberFormatter {
        let f = NumberFormatter()
        f.locale = AppLocale.locale
        f.numberStyle = .currency
        f.currencyCode = currency.rawValue
        f.currencySymbol = currency.symbol
        f.maximumFractionDigits = 2
        return f
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(currency.symbol)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Spacer()
                Text(currency.rawValue)
                    .font(Theme.Typography.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.8))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.12), in: Capsule())
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(name)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(.white.opacity(0.75))
                Text(formatter.string(from: NSNumber(value: balance)) ?? "\(currency.symbol)\(balance)")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .padding(16)
        .frame(width: 180, height: 130, alignment: .topLeading)
        .background(
            LinearGradient(
                colors: [currency.accent.opacity(selected ? 0.85 : 0.45), currency.accent.opacity(selected ? 0.55 : 0.2)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .stroke(selected ? .white.opacity(0.5) : .white.opacity(0.12), lineWidth: 1)
        )
        .scaleEffect(selected ? 1.0 : 0.96)
        .shadow(color: currency.accent.opacity(selected ? 0.4 : 0.15), radius: selected ? 16 : 8, x: 0, y: 6)
    }
}

struct BudgetBubble: View {
    let progress: Double

    private var tint: Color {
        if progress < 0.6 { return Theme.Palette.mint }
        if progress < 0.85 { return Theme.Palette.amber }
        return Theme.Palette.rose
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.1), lineWidth: 10)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: [tint, tint.opacity(0.7)],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(Theme.Motion.smooth, value: progress)

            VStack(spacing: 0) {
                Text("\(Int(progress * 100))")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                Text("%")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.secondaryText)
            }
        }
        .frame(width: 80, height: 80)
    }
}

struct EmptyStateCard: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Theme.Palette.tertiaryText)
            Text(title)
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
            Text(subtitle)
                .font(Theme.Typography.footnote)
                .foregroundStyle(Theme.Palette.tertiaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }
}
