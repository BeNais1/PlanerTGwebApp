import SwiftUI

struct TransactionDetailView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let transaction: FinanceTransaction

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    Image(systemName: transaction.category.systemImage)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(PlanerTheme.accent)
                        .frame(width: 62, height: 62)
                        .background(PlanerTheme.accent.opacity(0.14), in: Circle())
                    Text(transaction.currency.formatted(transaction.amount))
                        .font(.largeTitle.bold())
                    Text(transaction.note.isEmpty ? transaction.category.title : transaction.note)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            }

            Section("Деталі") {
                LabeledContent("Тип", value: transaction.kind.title)
                LabeledContent("Категорія", value: transaction.category.title)
                LabeledContent("Дата", value: transaction.date.formatted(date: .long, time: .omitted))
                if let wallet = store.wallet(id: transaction.walletID) {
                    LabeledContent("Гаманець", value: wallet.name)
                }
            }

            Section {
                Button("Видалити операцію", role: .destructive) {
                    store.deleteTransaction(transaction)
                    dismiss()
                }
            }
        }
        .navigationTitle("Операція")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Готово") { dismiss() } }
        }
    }
}
