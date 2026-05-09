import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore
    @Binding var showingAddSheet: Bool
    @State private var showingSettings = false

    private var budgetProgress: Double {
        guard store.settings.budgetLimit > 0 else { return 0 }
        return min(store.periodExpenses / store.settings.budgetLimit, 1)
    }

    var body: some View {
        ZStack {
            AppBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    balanceCard
                    budgetCard
                    quickActions
                    todayList
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)
                .padding(.bottom, 28)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(store)
                .presentationDetents([.medium])
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(Date.now.formatted(.dateTime.month(.wide).year()))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.68))
                Text("Expense Tracker")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.white)
            }

            Spacer()

            Button {
                showingSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.title3.weight(.semibold))
                    .frame(width: 48, height: 48)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .liquidGlass(interactive: true, in: Circle())
            .accessibilityLabel("Настройки")
        }
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Текущий баланс", systemImage: "wallet.pass.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))

            Text(store.formatted(store.currentBalance))
                .font(.system(size: 46, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(.white)

            HStack(spacing: 10) {
                MetricPill(title: "Расходы", value: store.formatted(store.periodExpenses), symbol: "arrow.up.right")
                MetricPill(title: "Лимит", value: store.formatted(store.settings.budgetLimit), symbol: "target")
            }
        }
        .glassCard()
    }

    private var budgetCard: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle()
                    .stroke(.white.opacity(0.12), lineWidth: 13)
                Circle()
                    .trim(from: 0, to: budgetProgress)
                    .stroke(.mint, style: StrokeStyle(lineWidth: 13, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int(budgetProgress * 100))%")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 82, height: 82)

            VStack(alignment: .leading, spacing: 7) {
                Text("Лимит на \(store.settings.budgetPeriod.title.lowercased())")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("Осталось \(store.formatted(max(store.settings.budgetLimit - store.periodExpenses, 0)))")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.68))
            }

            Spacer()
        }
        .glassCard(cornerRadius: 24)
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            ActionButton(title: "Расход", systemImage: "minus", tint: .pink) {
                showingAddSheet = true
            }
            ActionButton(title: "Доход", systemImage: "plus", tint: .mint) {
                showingAddSheet = true
            }
            ActionButton(title: "Чек", systemImage: "qrcode.viewfinder", tint: .cyan) {
                store.addReceipt(title: "Новый чек", merchant: "Сохранено вручную", amount: 0, currency: store.settings.mainCurrency)
            }
        }
    }

    private var todayList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Сегодня")
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)

            if store.todayTransactions.isEmpty {
                Text("Транзакций пока нет")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.62))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .glassCard(cornerRadius: 22)
            } else {
                ForEach(store.todayTransactions) { item in
                    TransactionRow(item: item)
                }
            }
        }
    }
}

private struct MetricPill: View {
    let title: String
    let value: String
    let symbol: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.white.opacity(0.54))
                Text(value)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct ActionButton: View {
    let title: String
    let systemImage: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.title3.weight(.bold))
                    .frame(width: 34, height: 34)
                    .background(tint.opacity(0.22), in: Circle())
                Text(title)
                    .font(.footnote.weight(.semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 92)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: tint.opacity(0.1), interactive: true, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}
