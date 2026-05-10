import SwiftUI

struct TransactionRow: View {
    @EnvironmentObject private var store: AppStore
    let item: TransactionItem

    private var resolvedCategory: Category {
        expenseCategories.first(where: { $0.id == item.category }) ?? expenseCategories.last!
    }

    private var title: String {
        if item.kind == .income { return "Income" }
        return resolvedCategory.title
    }

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: item.kind == .income ? "arrow.down.left" : resolvedCategory.symbol)
                .font(.headline.weight(.semibold))
                .foregroundStyle(item.kind == .income ? .mint : resolvedCategory.color)
                .frame(width: 42, height: 42)
                .background(.white.opacity(0.08), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(item.note.isEmpty ? item.date.formatted(date: .abbreviated, time: .shortened) : item.note)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))
                    .lineLimit(1)
            }

            Spacer()

            Text("\(item.kind.sign)\(store.formatted(item.amount, currency: item.currency))")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(item.kind == .income ? .mint : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .glassCard(cornerRadius: 22)
    }
}
