import SwiftUI

struct PaydayCard: View {
    @Environment(FinanceStore.self) private var store
    @State private var editing = false
    var body: some View {
        Button { editing = true } label: {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("До зарплати").font(.subheadline).foregroundStyle(.secondary)
                    if let settings = store.payday {
                        let days = Planning.days(until: settings.date)
                        if days > 0 {
                            Text(store.mainCurrency.formatted(store.paydayAvailable(settings) / Double(days)) + " / день")
                                .font(.title3.weight(.semibold)).contentTransition(.numericText())
                            Text(settings.date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
                        } else { Text("Оновіть дату зарплати").font(.headline) }
                    } else { Text("Налаштувати").font(.headline) }
                }
                Spacer()
                Image(systemName: "calendar").font(.title3).foregroundStyle(.secondary)
            }
            .padding(18).contentCard()
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $editing) { NavigationStack { PaydayEditor() } }
    }
}

struct PaydayEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var date = Calendar.current.date(byAdding: .day, value: 14, to: .now) ?? .now
    @State private var reserve = "0"
    @State private var walletIDs = Set<UUID>()
    private var amount: Double? { Double(reserve.replacingOccurrences(of: ",", with: ".")) }
    var body: some View {
        Form {
            Section {
                DatePicker("Дата зарплати", selection: $date, in: Date.now..., displayedComponents: .date)
                TextField("Резерв, \(store.mainCurrency.symbol)", text: $reserve).keyboardType(.decimalPad)
            } footer: { Text("Денна сума = баланс обраних карток мінус резерв, поділений на дні до зарплати. Майбутні платежі врахуйте в резерві.") }
            Section("Картки") {
                ForEach(store.wallets) { wallet in
                    Toggle(wallet.name, isOn: Binding(get: { walletIDs.contains(wallet.id) }, set: { value in
                        if value { walletIDs.insert(wallet.id) } else { walletIDs.remove(wallet.id) }
                    }))
                }
            }
            if store.payday != nil {
                Button("Вимкнути режим", role: .destructive) { store.setPayday(nil); dismiss() }
                    .disabled(!store.allowsEditing)
            }
        }
        .navigationTitle("До зарплати").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Скасувати") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Зберегти") {
                    guard let amount else { return }
                    store.setPayday(PaydaySettings(date: date, reserve: amount, walletIDs: Array(walletIDs)))
                    dismiss()
                }.disabled(!store.allowsEditing || walletIDs.isEmpty || amount == nil || !(amount?.isFinite ?? false) || (amount ?? -1) < 0 || Planning.days(until: date) < 1)
            }
        }
        .onAppear {
            if let settings = store.payday { date = max(.now, settings.date); reserve = String(settings.reserve); walletIDs = Set(settings.walletIDs) }
            else { walletIDs = Set(store.wallets.map(\.id)) }
        }
    }
}

struct WalletActionsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let wallet: Wallet
    @State private var actual = ""
    @State private var deleting = false
    @State private var confirming = false
    private var amount: Double? { Double(actual.replacingOccurrences(of: ",", with: ".")) }
    private var current: Wallet? { store.wallet(id: wallet.id) }
    var body: some View {
        Form {
            Section("Звірка балансу") {
                LabeledContent("У Planer", value: wallet.currency.formatted(current?.balance ?? wallet.balance))
                TextField("Фактичний баланс", text: $actual).keyboardType(.numbersAndPunctuation)
                if let amount, amount.isFinite {
                    LabeledContent("Коригування", value: wallet.currency.formatted(amount - (current?.balance ?? wallet.balance)))
                }
                Button("Звірити") { confirming = true }
                    .disabled(!store.allowsEditing || current == nil || !(amount?.isFinite ?? false))
            } footer: { Text("Коригування збережеться в історії та не вплине на статистику витрат і доходів.") }
            Section {
                Button("Видалити картку", role: .destructive) { deleting = true }.disabled(!store.allowsEditing)
            }
        }
        .navigationTitle(wallet.name).navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Готово") { dismiss() } } }
        .onAppear { actual = String(current?.balance ?? wallet.balance) }
        .confirmationDialog("Змінити баланс?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Підтвердити") {
                if let amount, store.reconcile(walletID: wallet.id, actualBalance: amount) { dismiss() }
            }
        }
        .confirmationDialog("Видалити картку \(wallet.name)?", isPresented: $deleting, titleVisibility: .visible) {
            Button("Видалити", role: .destructive) { store.deleteWallet(id: wallet.id); dismiss() }
        } message: { Text("Її баланс більше не враховуватиметься. Історія залишиться; інші картки не зміняться. Для пов’язаних кредитів потрібно обрати нову картку.") }
    }
}
