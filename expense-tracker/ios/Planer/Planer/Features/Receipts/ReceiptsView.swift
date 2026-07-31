import SwiftUI

struct ReceiptsView: View {
    @Environment(FinanceStore.self) private var store

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                LazyVStack(spacing: 12) {
                    if store.receipts.isEmpty {
                        ContentUnavailableView(
                            "Немає збережених чеків",
                            systemImage: "bookmark.slash",
                            description: Text("Чеки, збережені з посилань, з’являться тут")
                        )
                        .frame(minHeight: 360)
                        .contentCard()
                    } else {
                        ForEach(store.receipts) { receipt in
                            receiptCard(receipt)
                        }
                    }

                    syncNotice
                }
                .padding(18)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Чеки")
    }

    private func receiptCard(_ receipt: ReceiptSummary) -> some View {
        HStack(spacing: 14) {
            Image(systemName: receipt.isShared ? "person.2.fill" : "receipt.fill")
                .font(.headline)
                .foregroundStyle(receipt.isShared ? PlanerTheme.accent : .secondary)
                .frame(width: 44, height: 44)
                .background((receipt.isShared ? PlanerTheme.accent : Color.secondary).opacity(0.14), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(receipt.merchant).font(.headline)
                Text(receipt.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(receipt.currency.formatted(receipt.amount))
                    .font(.subheadline.bold())
                Text(receipt.isShared ? "Спільний" : "Особистий")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(receipt.isShared ? PlanerTheme.accent : .secondary)
            }
        }
        .padding(16)
        .contentCard()
        .accessibilityElement(children: .combine)
    }

    private var syncNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "icloud.slash")
                .foregroundStyle(PlanerTheme.warning)
            VStack(alignment: .leading, spacing: 4) {
                Text("Синхронізація ще не підключена")
                    .font(.subheadline.weight(.semibold))
                Text("Telegram Mini App використовує власний initData та Firebase-токен. Для iOS потрібне зв’язування облікового запису.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .contentCard()
    }
}

#Preview("Receipts") {
    NavigationStack { ReceiptsView() }
        .environment(FinanceStore(loadPersisted: false, persistsChanges: false))
        .preferredColorScheme(.dark)
}
