import SwiftUI

struct TransactionDetailView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let transaction: FinanceTransaction

    @State private var receiptTransaction: FinanceTransaction?
    @State private var selectedReceipt: ReceiptSummary?
    @State private var deleting = false
    @State private var tagsText = ""

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    Image(systemName: category.systemImage)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(category.tint)
                        .frame(width: 62, height: 62)
                        .background(category.tint.opacity(0.14), in: Circle())
                    Text(transaction.currency.formatted(transaction.amount))
                        .font(.largeTitle.bold())
                    Text(transaction.note.isEmpty ? category.title : transaction.note)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            }

            Section("Деталі") {
                if transaction.kind == .expense {
                    TextField("Теги через кому", text: $tagsText).textInputAutocapitalization(.never)
                        .disabled(!store.allowsEditing)
                    Button("Зберегти теги") { store.updateTags(transactionID: transaction.id, text: tagsText) }
                        .disabled(!store.allowsEditing)
                }
                if let tags = transaction.tags, !tags.isEmpty {
                    LabeledContent("Теги", value: tags.map { "#" + $0 }.joined(separator: " "))
                }
                if transaction.isReconciliation == true {
                    Text("Звірка балансу · не враховується у статистиці").font(.caption).foregroundStyle(.secondary)
                }
                LabeledContent("Тип", value: transaction.kind.title)
                LabeledContent("Категорія", value: category.title)
                LabeledContent("Дата", value: transaction.date.formatted(date: .long, time: .omitted))
                LabeledContent("Час", value: transaction.date.formatted(date: .omitted, time: .shortened))
                if let wallet = store.wallet(id: transaction.walletID) {
                    LabeledContent("Гаманець", value: wallet.name)
                }
                if let author = transaction.authorName?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !author.isEmpty {
                    LabeledContent("Додав(ла)", value: author)
                }
            }

            Section("Чек") {
                if let receipt = store.receipt(for: transaction.id) {
                    Button {
                        selectedReceipt = receipt
                    } label: {
                        Label("Відкрити цифровий чек", systemImage: "receipt.fill")
                    }
                    LabeledContent("Назва чека", value: receipt.merchant)
                } else {
                    Button {
                        receiptTransaction = transaction
                    } label: {
                        Label("Створити чек", systemImage: "receipt.badge.plus")
                    }
                }
            }

            Section {
                Button("Видалити операцію", role: .destructive) {
                    deleting = true
                }
                .disabled(!store.allowsEditing || store.wallet(id: transaction.walletID) == nil)
            }
        }
        .navigationTitle("Операція")
        .onAppear { tagsText = (store.transactions.first { $0.id == transaction.id }?.tags ?? []).joined(separator: ", ") }
        .confirmationDialog("Видалити операцію?", isPresented: $deleting, titleVisibility: .visible) {
            Button("Видалити", role: .destructive) { store.deleteTransaction(transaction); dismiss() }
        } message: { Text("Зміна балансу цієї операції буде скасована.") }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Готово") { dismiss() } }
        }
        .sheet(item: $receiptTransaction) { transaction in
            NavigationStack {
                ReceiptEditorView(transaction: transaction)
            }
        }
        .sheet(item: $selectedReceipt) { receipt in
            NavigationStack { ReceiptDetailView(receipt: receipt) }
        }
    }

    private var category: TransactionCategoryPresentation {
        store.categoryPresentation(for: transaction)
    }
}

private struct ReceiptEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AuthSession.self) private var authSession
    @Environment(\.dismiss) private var dismiss

    let transaction: FinanceTransaction

    @State private var merchant: String

    init(transaction: FinanceTransaction) {
        self.transaction = transaction
        _merchant = State(
            initialValue: transaction.note.isEmpty
                ? transaction.category.title
                : transaction.note
        )
    }

    var body: some View {
        Form {
            Section("Чек") {
                TextField("Назва чека або місце", text: $merchant)
                LabeledContent("Сума", value: transaction.currency.formatted(transaction.amount))
                LabeledContent("Категорія", value: store.categoryPresentation(for: transaction).title)
                LabeledContent(
                    "Дата й час",
                    value: transaction.date.formatted(date: .abbreviated, time: .shortened)
                )
            }

            Section {
                Text("Чек буде збережено у Firebase разом з іншими фінансовими даними.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Створити чек")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Зберегти") {
                    let authorName: String?
                    if case .signedIn(let user) = authSession.state {
                        authorName = user.displayName
                    } else {
                        authorName = nil
                    }
                    if store.createReceipt(for: transaction, merchant: merchant, authorName: authorName) != nil {
                        dismiss()
                    }
                }
                .disabled(merchant.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }
}
