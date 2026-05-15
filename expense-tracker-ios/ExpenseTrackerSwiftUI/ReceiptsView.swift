import SwiftUI

struct ReceiptsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingAddSheet = false
    @State private var sharingReceipt: ReceiptItem?

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                header

                if store.receipts.isEmpty {
                    EmptyStateCard(
                        icon: "bookmark",
                        title: "Чеків ще немає",
                        subtitle: "Збережіть перший чек, щоб ділитися з друзями"
                    )
                    .padding(.horizontal, 18)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(store.receipts) { receipt in
                            receiptCard(receipt)
                        }
                    }
                    .padding(.horizontal, 18)
                }

                Color.clear.frame(height: 100)
            }
            .padding(.top, 8)
        }
        .sheet(isPresented: $showingAddSheet) {
            AddReceiptSheet()
                .environmentObject(store)
                .presentationDetents([.medium])
                .presentationBackground(.clear)
        }
        .sheet(item: $sharingReceipt) { receipt in
            ReceiptShareSheet(receipt: receipt)
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationBackground(.clear)
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Чеки")
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(.white)
                Text("\(store.receipts.count) збережено")
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
            }
            Spacer()
            GlassIconButton(systemImage: "plus", tint: Theme.Palette.indigo.opacity(0.3)) {
                showingAddSheet = true
            }
        }
        .padding(.horizontal, 18)
    }

    private func receiptCard(_ receipt: ReceiptItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "receipt.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Palette.cyan)
                Spacer()
                Menu {
                    Button {
                        sharingReceipt = receipt
                    } label: {
                        Label("Поділитися", systemImage: "qrcode")
                    }
                    Button(role: .destructive) {
                        HapticFeedback.warning()
                        store.removeReceipt(receipt)
                    } label: {
                        Label("Видалити", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Palette.tertiaryText)
                        .frame(width: 28, height: 28)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(receipt.merchant)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(receipt.title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 2) {
                Text(store.formatted(receipt.amount, currency: receipt.currency))
                    .font(Theme.Typography.title2.weight(.bold))
                    .foregroundStyle(.white)
                Text(AppLocale.mediumDateFormatter.string(from: receipt.date))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
            }

            if receipt.shareCode != nil {
                HStack(spacing: 4) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 10, weight: .bold))
                    Text("Опубліковано")
                        .font(Theme.Typography.caption.weight(.semibold))
                }
                .foregroundStyle(Theme.Palette.mint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Theme.Palette.mint.opacity(0.15), in: Capsule())
            }
        }
        .padding(14)
        .frame(minHeight: 180, alignment: .topLeading)
        .liquidGlass(tint: .white.opacity(0.05), in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
        .onTapGesture {
            sharingReceipt = receipt
        }
    }
}

struct AddReceiptSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var merchant = ""
    @State private var title = "Чек"
    @State private var amount = ""
    @State private var currency: CurrencyCode = .eur

    var body: some View {
        ZStack {
            AppBackground(palette: .sunsetPeach)

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Новий чек")
                        .font(Theme.Typography.title)
                        .foregroundStyle(.white)
                    Spacer()
                    GlassIconButton(systemImage: "xmark") { dismiss() }
                }
                .padding(.top, 14)

                field("Назва магазину", text: $merchant)
                field("Опис", text: $title)
                amountField

                HStack(spacing: 8) {
                    ForEach(store.settings.enabledCurrencies) { code in
                        GlassChip(title: "\(code.symbol) \(code.rawValue)", isSelected: code == currency, tint: code.accent) {
                            currency = code
                        }
                    }
                    Spacer()
                }

                Spacer()

                Button {
                    let amt = Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
                    store.addReceipt(
                        title: title.isEmpty ? "Чек" : title,
                        merchant: merchant.isEmpty ? "Без назви" : merchant,
                        amount: amt,
                        currency: currency
                    )
                    HapticFeedback.success()
                    dismiss()
                } label: {
                    Text("Зберегти")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.Gradient.primaryButton)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.bottom, 18)
            }
            .padding(.horizontal, 18)
        }
        .onAppear { currency = store.settings.mainCurrency }
    }

    private func field(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .font(Theme.Typography.callout)
            .foregroundStyle(.white)
            .tint(Theme.Palette.indigo)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private var amountField: some View {
        HStack {
            Text(currency.symbol)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Palette.tertiaryText)
            TextField("0.00", text: $amount)
                .font(Theme.Typography.headline.weight(.bold))
                .foregroundStyle(.white)
                .keyboardType(.decimalPad)
                .tint(Theme.Palette.indigo)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }
}
