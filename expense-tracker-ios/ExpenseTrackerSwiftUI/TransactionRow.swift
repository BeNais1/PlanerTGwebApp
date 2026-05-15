import SwiftUI

struct TransactionRow: View {
    @EnvironmentObject private var store: AppStore
    let item: TransactionItem

    private var category: Category {
        categoryById(item.category, customCategories: store.settings.customCategories)
    }

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(category.color.opacity(0.22))
                    .frame(width: 44, height: 44)
                Image(systemName: category.symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(category.color)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.note.isEmpty ? category.title : item.note)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(category.title)
                    Text("·")
                    Text(AppLocale.timeFormatter.string(from: item.date))
                }
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Palette.tertiaryText)
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(item.kind.sign)\(store.formatted(item.amount, currency: item.currency))")
                    .font(Theme.Typography.headline.weight(.bold))
                    .foregroundStyle(item.kind.tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if item.currency != store.settings.mainCurrency {
                    Text("≈ \(store.formatted(store.convert(item.amount, from: item.currency, to: store.settings.mainCurrency)))")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }
}
