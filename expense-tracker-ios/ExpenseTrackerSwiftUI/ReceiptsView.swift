import SwiftUI

struct ReceiptsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var merchant = ""
    @State private var amount = ""

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Сохранённые чеки")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(.white)

                    quickSave

                    ForEach(store.receipts) { receipt in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label(receipt.merchant, systemImage: "receipt.fill")
                                    .font(.headline.weight(.semibold))
                                Spacer()
                                Text(store.formatted(receipt.amount, currency: receipt.currency))
                                    .font(.headline.weight(.bold))
                            }
                            Text(receipt.date.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.58))
                        }
                        .foregroundStyle(.white)
                        .glassCard(cornerRadius: 22)
                    }
                }
                .padding(18)
                .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var quickSave: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Магазин", text: $merchant)
                .textFieldStyle(.roundedBorder)
            TextField("Сумма", text: $amount)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
            Button {
                store.addReceipt(
                    title: merchant.isEmpty ? "Чек" : merchant,
                    merchant: merchant.isEmpty ? "Без названия" : merchant,
                    amount: Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0,
                    currency: store.settings.mainCurrency
                )
                merchant = ""
                amount = ""
            } label: {
                Label("Сохранить чек", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.mint)
        }
        .glassCard(cornerRadius: 24)
    }
}
