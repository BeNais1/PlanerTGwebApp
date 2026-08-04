import SwiftUI

struct ReceiptsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(FirebaseSyncStore.self) private var syncStore
    @State private var selectedReceipt: ReceiptSummary?

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                LazyVStack(spacing: 12) {
                    if store.receipts.isEmpty {
                        ContentUnavailableView(
                            "Немає збережених чеків",
                            systemImage: "bookmark.slash",
                            description: Text("Відкрийте операцію та натисніть «Створити чек»")
                        )
                        .frame(minHeight: 360)
                        .contentCard()
                    } else {
                        ForEach(store.receipts.sorted { $0.date > $1.date }) { receipt in
                            Button {
                                selectedReceipt = receipt
                            } label: {
                                ReceiptListCard(receipt: receipt)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    syncNotice
                }
                .padding(18)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Чеки")
        .sheet(item: $selectedReceipt) { receipt in
            NavigationStack { ReceiptDetailView(receipt: receipt) }
        }
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

private struct ReceiptListCard: View {
    let receipt: ReceiptSummary

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: receipt.categorySystemImage ?? "receipt.fill")
                .font(.headline)
                .foregroundStyle(receipt.isShared ? PlanerTheme.accent : .secondary)
                .frame(width: 44, height: 44)
                .background((receipt.isShared ? PlanerTheme.accent : Color.secondary).opacity(0.14), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(receipt.merchant).font(.headline)
                Text(receipt.date.formatted(date: .abbreviated, time: .shortened))
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
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Відкрити цифровий чек")
    }
}

struct ReceiptDetailView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(FirebaseSyncStore.self) private var syncStore
    @Environment(\.dismiss) private var dismiss

    let receipt: ReceiptSummary

    @State private var shareLink: FirebaseSyncStore.ReceiptShareLink?
    @State private var isPublishing = false
    @State private var shareError: String?

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                VStack(spacing: 18) {
                    DigitalReceiptTicket(receipt: receipt)

                    if let shareError {
                        Label(shareError, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(PlanerTheme.negative)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .contentCard()
                    }

                    shareAction
                }
                .padding(18)
                .padding(.bottom, 20)
            }
        }
        .navigationTitle("Цифровий чек")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
        .onAppear {
            guard let code = receipt.shareCode,
                  let url = URL(string: "https://planer-app-3a0f2.web.app/?receipt=\(code)") else { return }
            shareLink = .init(code: code, url: url)
        }
    }

    @ViewBuilder
    private var shareAction: some View {
        if let shareLink {
            ShareLink(
                item: shareLink.url,
                subject: Text("Чек Planer"),
                message: Text("Відкрийте чек у Planner. Код: \(shareLink.code)")
            ) {
                Label("Поділитися чеком", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .planerProminentButton()
        } else {
            Button {
                Task { await prepareShareLink() }
            } label: {
                HStack {
                    if isPublishing { ProgressView().controlSize(.small) }
                    Label(
                        isPublishing ? "Створюємо посилання…" : "Поділитися чеком",
                        systemImage: "square.and.arrow.up"
                    )
                }
                .frame(maxWidth: .infinity, minHeight: 50)
            }
            .planerProminentButton()
            .disabled(isPublishing)
        }
    }

    private func prepareShareLink() async {
        isPublishing = true
        shareError = nil
        do {
            let link = try await syncStore.publish(receipt: receipt)
            shareLink = link
            store.markReceiptShared(id: receipt.id, shareCode: link.code)
        } catch {
            shareError = error.localizedDescription
        }
        isPublishing = false
    }
}

private struct DigitalReceiptTicket: View {
    let receipt: ReceiptSummary

    var body: some View {
        VStack(spacing: 18) {
            VStack(spacing: 5) {
                Text("PLANER")
                    .font(.system(.title2, design: .monospaced, weight: .black))
                    .tracking(3)
                Text("DIGITAL RECEIPT")
                    .font(.system(.caption2, design: .monospaced, weight: .medium))
                    .foregroundStyle(.black.opacity(0.54))
            }

            dashedDivider

            Image(systemName: receipt.categorySystemImage ?? "receipt.fill")
                .font(.title2)
            Text(receipt.merchant)
                .font(.system(.title3, design: .monospaced, weight: .bold))
                .multilineTextAlignment(.center)
            Text(amountText)
                .font(.system(size: 34, weight: .black, design: .monospaced))
                .contentTransition(.numericText())

            dashedDivider

            receiptRow("ТИП", receipt.transactionKind?.title ?? "Операція")
            receiptRow("КАТЕГОРІЯ", receipt.categoryTitle ?? "Інше")
            if let walletName = receipt.walletName, !walletName.isEmpty {
                receiptRow("ГАМАНЕЦЬ", walletName)
            }
            if let note = receipt.note, !note.isEmpty {
                receiptRow("КОМЕНТАР", note)
            }
            receiptRow("ДАТА", receipt.date.formatted(date: .long, time: .shortened))
            receiptRow("СТВОРИВ", receipt.authorName ?? "Користувач Planer")
            receiptRow("ID", receipt.shareCode ?? receipt.id.uuidString.prefix(8).uppercased())

            dashedDivider

            Text("ДЯКУЄМО, ЩО КОРИСТУЄТЕСЯ PLANER")
                .font(.system(.caption2, design: .monospaced, weight: .semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(.black.opacity(0.56))
        }
        .foregroundStyle(.black.opacity(0.86))
        .padding(.horizontal, 26)
        .padding(.vertical, 30)
        .background(Color(white: 0.86), in: ReceiptTicketShape())
        .overlay { ReceiptTicketShape().stroke(.white.opacity(0.65), lineWidth: 1) }
        .shadow(color: .black.opacity(0.18), radius: 22, y: 12)
    }

    private var amountText: String {
        let prefix = receipt.transactionKind == .income ? "+" : receipt.transactionKind == .expense ? "−" : ""
        return prefix + receipt.currency.formatted(receipt.amount)
    }

    private var dashedDivider: some View {
        Rectangle()
            .stroke(style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
            .foregroundStyle(.black.opacity(0.28))
            .frame(height: 1)
    }

    private func receiptRow(_ title: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .foregroundStyle(.black.opacity(0.48))
            Spacer(minLength: 12)
            Text(value)
                .multilineTextAlignment(.trailing)
        }
        .font(.system(.caption, design: .monospaced, weight: .semibold))
    }
}

private struct ReceiptTicketShape: Shape {
    func path(in rect: CGRect) -> Path {
        let tooth: CGFloat = 10
        var path = Path()
        path.move(to: CGPoint(x: 0, y: tooth))
        path.addLine(to: CGPoint(x: 0, y: rect.maxY - tooth))

        var x: CGFloat = 0
        while x < rect.width {
            path.addLine(to: CGPoint(x: min(x + tooth / 2, rect.width), y: rect.maxY))
            path.addLine(to: CGPoint(x: min(x + tooth, rect.width), y: rect.maxY - tooth))
            x += tooth
        }

        path.addLine(to: CGPoint(x: rect.maxX, y: tooth))
        x = rect.width
        while x > 0 {
            path.addLine(to: CGPoint(x: max(x - tooth / 2, 0), y: 0))
            path.addLine(to: CGPoint(x: max(x - tooth, 0), y: tooth))
            x -= tooth
        }
        path.closeSubpath()
        return path
    }
}

#Preview("Receipts") {
    NavigationStack { ReceiptsView() }
        .environment(FinanceStore.previewStore())
        .environment(FirebaseSyncStore.preview())
        .preferredColorScheme(.dark)
}
