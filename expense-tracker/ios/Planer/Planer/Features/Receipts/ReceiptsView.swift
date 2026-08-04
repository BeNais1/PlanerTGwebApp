import SwiftUI

struct ReceiptsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(FirebaseSyncStore.self) private var syncStore

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
            Image(systemName: syncIcon)
                .foregroundStyle(syncColor)
            VStack(alignment: .leading, spacing: 4) {
                Text(syncStore.status.title)
                    .font(.subheadline.weight(.semibold))
                Text(syncDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .contentCard()
    }

    private var syncIcon: String {
        switch syncStore.status {
        case .connecting: "arrow.triangle.2.circlepath.icloud"
        case .synced: "checkmark.icloud.fill"
        case .error: "exclamationmark.icloud.fill"
        }
    }

    private var syncColor: Color {
        switch syncStore.status {
        case .connecting: PlanerTheme.warning
        case .synced: PlanerTheme.positive
        case .error: PlanerTheme.negative
        }
    }

    private var syncDescription: String {
        switch syncStore.status {
        case .connecting:
            "Підключаємося до вашого облікового запису Firebase."
        case .synced:
            "Чеки та фінансові дані збережено у вашому обліковому записі."
        case .error(let message):
            message
        }
    }
}

#Preview("Receipts") {
    NavigationStack { ReceiptsView() }
        .environment(FinanceStore.previewStore())
        .environment(FirebaseSyncStore.preview())
        .preferredColorScheme(.dark)
}
