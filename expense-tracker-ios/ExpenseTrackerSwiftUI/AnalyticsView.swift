import SwiftUI

struct AnalyticsView: View {
    @EnvironmentObject private var store: AppStore

    private var categoryTotals: [CategoryTotal] {
        expenseCategories.compactMap { category in
            let total = store.transactions
                .filter { $0.kind == .expense && $0.category == category.title }
                .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
            return total > 0 ? CategoryTotal(category: category, total: total) : nil
        }
        .sorted { $0.total > $1.total }
    }

    private var maxTotal: Double {
        categoryTotals.map(\.total).max() ?? 1
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
                            ForEach(categoryTotals) { item in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Label(item.category.title, systemImage: item.category.symbol)
                                        Spacer()
                                        Text(store.formatted(item.total))
                                    }
                                    .font(.subheadline.weight(.semibold))

                                    GeometryReader { proxy in
                                        Capsule()
                                            .fill(.white.opacity(0.12))
                                            .overlay(alignment: .leading) {
                                                Capsule()
                                                    .fill(item.category.color.gradient)
                                                    .frame(width: proxy.size.width * min(item.total / maxTotal, 1))
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

private struct CategoryTotal: Identifiable {
    let category: Category
    let total: Double

    var id: String { category.id }
}
