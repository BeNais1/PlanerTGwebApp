import SwiftUI

struct DashboardView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                VStack(spacing: 18) {
                    header
                    walletCarousel
                    budgetCard
                    transactionSection
                }
                .padding(.bottom, 104)
            }
            .scrollIndicators(.hidden)
        }
        .navigationBarHidden(true)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            GlassActionCluster(
                onExpense: { router.presentedSheet = .newTransaction(.expense) },
                onIncome: { router.presentedSheet = .newTransaction(.income) },
                onTransfer: { router.presentedSheet = .newTransaction(.transfer) }
            )
            .padding(.bottom, 6)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                router.presentedSheet = .settings
            } label: {
                HStack(spacing: 10) {
                    Text("Я")
                        .font(.subheadline.bold())
                        .frame(width: 32, height: 32)
                        .background(PlanerTheme.accent.gradient, in: Circle())
                        .foregroundStyle(.white)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(store.activeSpaceName)
                            .font(.subheadline.weight(.semibold))
                        Text(Date.now.formatted(.dateTime.month(.wide)))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Image(systemName: "chevron.down")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
            }
            .buttonStyle(.plain)
            .planerGlassCapsule()

            Spacer(minLength: 4)

            Button {
                router.presentedSheet = .settings
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .planerGlassCircle()
            .accessibilityLabel("Налаштування")
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
    }

    private var walletCarousel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Загальний баланс")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(store.mainCurrency.formatted(store.totalBalanceInMainCurrency))
                        .font(.title2.weight(.bold))
                        .contentTransition(.numericText())
                }
                Spacer()
            }
            .padding(.horizontal, 20)

            ScrollView(.horizontal) {
                LazyHStack(spacing: 14) {
                    ForEach(store.wallets) { wallet in
                        WalletCardView(wallet: wallet)
                            .containerRelativeFrame(.horizontal, count: 1, spacing: 14)
                    }

                    Button {
                        router.presentedSheet = .addWallet
                    } label: {
                        VStack(spacing: 10) {
                            Image(systemName: "plus")
                                .font(.title2.bold())
                                .frame(width: 48, height: 48)
                                .background(PlanerTheme.accent.opacity(0.14), in: Circle())
                            Text("Додати гаманець")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 176)
                        .contentCard()
                    }
                    .buttonStyle(.plain)
                    .containerRelativeFrame(.horizontal, count: 1, spacing: 14)
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, 18, for: .scrollContent)
            .scrollIndicators(.hidden)
            .scrollTargetBehavior(.viewAligned)
        }
    }

    private var budgetCard: some View {
        Button {
            router.presentedSheet = .budget
        } label: {
            VStack(spacing: 11) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Ліміт на місяць")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(store.mainCurrency.formatted(store.monthlyExpenses))
                            .font(.headline)
                    }
                    Spacer()
                    Text("з \(store.mainCurrency.formatted(store.budgetLimit))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }

                ProgressView(value: store.budgetProgress)
                    .tint(store.budgetProgress >= 1 ? PlanerTheme.negative : PlanerTheme.accent)
                    .scaleEffect(x: 1, y: 1.8, anchor: .center)
            }
            .padding(16)
            .contentCard()
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 18)
        .accessibilityHint("Відкрити налаштування ліміту")
    }

    private var transactionSection: some View {
        let rows = Array(store.recentTransactions.prefix(6))

        return VStack(spacing: 0) {
            HStack {
                Text("Останні операції")
                    .font(.headline)
                Spacer()
                Text("\(store.recentTransactions.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            if store.recentTransactions.isEmpty {
                ContentUnavailableView(
                    "Ще немає операцій",
                    systemImage: "tray",
                    description: Text("Додайте витрату або дохід")
                )
                .frame(minHeight: 180)
            } else {
                ForEach(rows) { transaction in
                    Button {
                        router.presentedSheet = .transaction(transaction)
                    } label: {
                        TransactionRowView(transaction: transaction)
                    }
                    .buttonStyle(.plain)

                    if transaction.id != rows.last?.id {
                        Divider().padding(.leading, 62)
                    }
                }
            }
        }
        .padding(.bottom, 8)
        .contentCard()
        .padding(.horizontal, 18)
    }
}

struct WalletCardView: View {
    let wallet: Wallet

    var body: some View {
        ZStack(alignment: .topTrailing) {
            PlanerTheme.walletGradient(wallet.palette)

            Circle()
                .fill(.white.opacity(0.11))
                .frame(width: 170, height: 170)
                .offset(x: 54, y: -64)

            Circle()
                .fill(.white.opacity(0.07))
                .frame(width: 100, height: 100)
                .offset(x: -28, y: 114)

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(wallet.name)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "wave.3.right")
                        .font(.headline)
                        .rotationEffect(.degrees(90))
                }
                .foregroundStyle(.white.opacity(0.88))

                Spacer()

                Text(wallet.currency.formatted(wallet.balance))
                    .font(.system(size: 31, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.72)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                Text(wallet.currency.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.64))
                    .padding(.top, 3)
            }
            .foregroundStyle(.white)
            .padding(20)
        }
        .frame(height: 176)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: .black.opacity(0.20), radius: 18, y: 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(wallet.name), \(wallet.currency.formatted(wallet.balance))")
    }
}

struct TransactionRowView: View {
    let transaction: FinanceTransaction

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.category.systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 38, height: 38)
                .background(iconColor.opacity(0.14), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.note.isEmpty ? transaction.category.title : transaction.note)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("\(transaction.category.title) · \(transaction.date.formatted(.dateTime.day().month(.abbreviated)))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Text(amountText)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(amountColor)
                .monospacedDigit()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }

    private var iconColor: Color {
        switch transaction.kind {
        case .expense: transaction.category.tint
        case .income: PlanerTheme.positive
        case .transfer: PlanerTheme.accent
        }
    }

    private var amountColor: Color {
        transaction.kind == .income ? PlanerTheme.positive : .primary
    }

    private var amountText: String {
        let prefix = transaction.kind == .income ? "+" : transaction.kind == .expense ? "−" : ""
        return prefix + transaction.currency.formatted(transaction.amount)
    }
}

#Preview("Dashboard") {
    NavigationStack { DashboardView() }
        .environment(FinanceStore.previewStore())
        .environment(AppRouter())
        .preferredColorScheme(.dark)
}
