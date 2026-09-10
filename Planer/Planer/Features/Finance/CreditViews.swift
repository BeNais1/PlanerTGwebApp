import SwiftUI

private struct CreditPaymentDraft: Identifiable {
    let id = UUID()
    var dueDate = Calendar.current.date(byAdding: .month, value: 1, to: .now) ?? .now
    var amountText = ""
    var deductFromWallet = true
}

struct CreditEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FinanceStore.self) private var store
    @State private var title = ""
    @State private var lender = ""
    @State private var currency: Currency = .UAH
    @State private var walletID: UUID?
    @State private var payments = [CreditPaymentDraft()]

    var body: some View {
        Form {
            Section("Кредит") {
                TextField("Назва", text: $title)
                TextField("Банк або кредитор", text: $lender)
                Picker("Валюта", selection: $currency) {
                    ForEach(Currency.allCases) { Text($0.rawValue).tag($0) }
                }
                Picker("Картка для списання", selection: $walletID) {
                    Text("Не обрано").tag(nil as UUID?)
                    ForEach(store.wallets) { wallet in
                        Text("\(wallet.name) · \(wallet.currency.rawValue)").tag(wallet.id as UUID?)
                    }
                }
                if requiresWallet && walletID == nil {
                    Label("Оберіть картку або вимкніть списання в платежах", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(PlanerTheme.warning)
                }
            }

            Section {
                ForEach($payments) { $payment in
                    VStack(alignment: .leading, spacing: 10) {
                        DatePicker("Дата платежу", selection: $payment.dueDate, displayedComponents: [.date])
                        TextField("Сума", text: $payment.amountText)
                            .keyboardType(.decimalPad)
                        Toggle("Списати з картки після підтвердження", isOn: $payment.deductFromWallet)
                        if payments.count > 1 {
                            Button("Видалити дату", role: .destructive) {
                                payments.removeAll { $0.id == payment.id }
                            }
                        }
                    }
                }

                Button {
                    var next = CreditPaymentDraft()
                    if let lastDate = payments.last?.dueDate {
                        next.dueDate = Calendar.current.date(byAdding: .month, value: 1, to: lastDate) ?? lastDate
                    }
                    payments.append(next)
                } label: {
                    Label("Додати дату платежу", systemImage: "calendar.badge.plus")
                }
            } header: {
                Text("Графік платежів")
            } footer: {
                Text("Для кожної дати Planer створить термінове нагадування. Списання відбудеться лише після вашого підтвердження платежу.")
            }
        }
        .navigationTitle("Новий кредит")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Додати") {
                    store.addCredit(
                        title: title,
                        lender: lender,
                        currency: currency,
                        walletID: walletID,
                        payments: parsedPayments
                    )
                    dismiss()
                }
                .disabled(
                    title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || parsedPayments.isEmpty
                    || (requiresWallet && walletID == nil)
                )
            }
        }
    }

    private var parsedPayments: [CreditPayment] {
        payments.compactMap { draft in
            let normalized = draft.amountText.replacingOccurrences(of: ",", with: ".")
            guard let amount = Double(normalized), amount > 0 else { return nil }
            return CreditPayment(
                dueDate: draft.dueDate,
                amount: amount,
                deductFromWallet: draft.deductFromWallet
            )
        }
    }

    private var requiresWallet: Bool {
        parsedPayments.contains(where: \.deductFromWallet)
    }
}

struct CreditDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FinanceStore.self) private var store
    let creditID: UUID
    @State private var paymentToConfirm: CreditPayment?
    @State private var showDeleteConfirmation = false

    var body: some View {
        Group {
            if let credit {
                List {
                    Section("Залишок") {
                        LabeledContent("До сплати", value: credit.currency.formatted(credit.remainingAmount))
                        if !credit.lender.isEmpty { LabeledContent("Кредитор", value: credit.lender) }
                        if let walletID = credit.walletID, let wallet = store.wallet(id: walletID) {
                            LabeledContent("Картка", value: wallet.name)
                        }
                    }

                    Section("Платежі") {
                        ForEach(credit.payments.sorted(by: { $0.dueDate < $1.dueDate })) { payment in
                            HStack(spacing: 12) {
                                Image(systemName: payment.isPaid ? "checkmark.circle.fill" : "clock.badge.exclamationmark.fill")
                                    .foregroundStyle(payment.isPaid ? PlanerTheme.positive : PlanerTheme.warning)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(payment.dueDate.formatted(date: .long, time: .omitted))
                                    Text(payment.deductFromWallet ? "Зі списанням з картки" : "Без списання з картки")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(credit.currency.formatted(payment.amount)).font(.subheadline.bold())
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if !payment.isPaid { paymentToConfirm = payment }
                            }
                        }
                    }

                    Section {
                        Button("Видалити кредит", role: .destructive) { showDeleteConfirmation = true }
                    }
                }
            } else {
                ContentUnavailableView("Кредит не знайдено", systemImage: "creditcard")
            }
        }
        .navigationTitle(credit?.title ?? "Кредит")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "Позначити платіж виконаним?",
            isPresented: Binding(
                get: { paymentToConfirm != nil },
                set: { if !$0 { paymentToConfirm = nil } }
            ),
            presenting: paymentToConfirm
        ) { payment in
            Button(payment.deductFromWallet ? "Підтвердити і списати з картки" : "Підтвердити без списання") {
                _ = store.markCreditPaymentPaid(creditID: creditID, paymentID: payment.id)
            }
            Button("Скасувати", role: .cancel) { }
        } message: { payment in
            Text(payment.deductFromWallet
                 ? "Сума буде списана з обраної картки і додана до витрат."
                 : "Баланс карток не зміниться.")
        }
        .confirmationDialog("Видалити кредит?", isPresented: $showDeleteConfirmation) {
            Button("Видалити", role: .destructive) {
                store.deleteCredit(id: creditID)
                dismiss()
            }
            Button("Скасувати", role: .cancel) { }
        }
    }

    private var credit: CreditAccount? { store.credits.first { $0.id == creditID } }
}

#Preview("Credit") {
    NavigationStack { CreditEditorView() }
        .environment(FinanceStore.previewStore())
}
