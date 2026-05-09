import SwiftUI

struct AnalyticsView: View {
    @EnvironmentObject private var store: AppStore

    private var categoryTotals: [(Category, Double)] {
        expenseCategories.compactMap { category in
            let total = store.transactions
                .filter { $0.kind == .expense && $0.category == category.title }
                .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
            return total > 0 ? (category, total) : nil
        }
        .sorted { $0.1 > $1.1 }
    }

    private var maxTotal: Double {
        categoryTotals.map(\.1).max() ?? 1
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Аналитика")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(.white)

                    VStack(alignment: .leading, spacing: 16) {
                        Text("Расходы по категориям")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.white)

                        if categoryTotals.isEmpty {
                            Text("Добавьте расходы, чтобы увидеть аналитику.")
                                .foregroundStyle(.white.opacity(0.62))
                        } else {
                            ForEach(categoryTotals, id: \.0.id) { category, total in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Label(category.title, systemImage: category.symbol)
                                        Spacer()
                                        Text(store.formatted(total))
                                    }
                                    .font(.subheadline.weight(.semibold))

                                    GeometryReader { proxy in
                                        Capsule()
                                            .fill(.white.opacity(0.12))
                                            .overlay(alignment: .leading) {
                                                Capsule()
                                                    .fill(category.color.gradient)
                                                    .frame(width: proxy.size.width * min(total / maxTotal, 1))
                                            }
                                    }
                                    .frame(height: 10)
                                }
                            }
                        }
                    }
                    .glassCard(cornerRadius: 24)
                }
                .padding(18)
                .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
