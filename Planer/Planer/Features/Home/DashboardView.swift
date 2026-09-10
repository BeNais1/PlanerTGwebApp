import SwiftUI

struct DashboardView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(FamilyAccountStore.self) private var familyStore

    @State private var selectedWallet: Wallet?

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                VStack(spacing: 18) {
                    header
                    walletCarousel
                    PaydayCard().padding(.horizontal, 18)
                    budgetCard
                    transactionSection
                }
                .padding(.bottom, 104)
            }
            .scrollIndicators(.hidden)
        }
        .sheet(item: $selectedWallet) { wallet in NavigationStack { WalletActionsView(wallet: wallet) } }
        .navigationBarHidden(true)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            GlassActionCluster(
                onExpense: { router.presentedSheet = .newTransaction(.expense) },
                onIncome: { router.presentedSheet = .newTransaction(.income) },
                onTransfer: { router.presentedSheet = .newTransaction(.transfer) }
            )
            .disabled(!store.allowsEditing)
            .padding(.bottom, 6)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                router.presentedSheet = .spaceSwitcher
            } label: {
                HStack(spacing: 10) {
                    Text("Я")
                        .font(.subheadline.bold())
                        .frame(width: 32, height: 32)
                        .background(PlanerTheme.accent.gradient, in: Circle())
                        .foregroundStyle(.white)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(familyStore.activeSpace.title)
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
            if !store.wallets.isEmpty {
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
            }

            ScrollView(.horizontal) {
                LazyHStack(spacing: 14) {
                    ForEach(store.wallets) { wallet in
                        Button { selectedWallet = wallet } label: { WalletCardView(wallet: wallet) }
                            .buttonStyle(.plain)
                            .accessibilityHint("Звірка балансу та керування карткою")
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
                    .disabled(!store.allowsEditing)
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
        .disabled(!store.allowsEditing)
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
                    .font(.system(size: 31, weight: .semibold))
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
        .shadow(color: .black.opacity(0.06), radius: 6, y: 3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(wallet.name), \(wallet.currency.formatted(wallet.balance))")
    }
}

struct TransactionRowView: View {
    @Environment(FinanceStore.self) private var store
    let transaction: FinanceTransaction

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: category.systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 38, height: 38)
                .background(iconColor.opacity(0.14), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.note.isEmpty ? category.title : transaction.note)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                if let tags = transaction.tags, !tags.isEmpty {
                    Text(tags.map { "#" + $0 }.joined(separator: " ")).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Text(transactionMetadata)
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
        case .expense: category.tint
        case .income: PlanerTheme.positive
        case .transfer: PlanerTheme.accent
        }
    }

    private var category: TransactionCategoryPresentation {
        store.categoryPresentation(for: transaction)
    }

    private var amountColor: Color {
        transaction.kind == .income ? PlanerTheme.positive : .primary
    }

    private var amountText: String {
        let prefix = transaction.kind == .income ? "+" : transaction.kind == .expense ? "−" : ""
        return prefix + transaction.currency.formatted(transaction.amount)
    }

    private var transactionMetadata: String {
        var values = [
            category.title,
            transaction.date.formatted(.dateTime.day().month(.abbreviated).hour().minute())
        ]
        if let author = transaction.authorName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !author.isEmpty {
            values.append("Додав(ла): \(author)")
        }
        return values.joined(separator: " · ")
    }
}

#Preview("Dashboard") {
    NavigationStack { DashboardView() }
        .environment(FinanceStore.previewStore())
        .environment(AppRouter())
        .environment(FamilyAccountStore.preview())
        .preferredColorScheme(.dark)
}
