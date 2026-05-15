import SwiftUI

enum HubSection: String, CaseIterable, Identifiable {
    case goals
    case subscriptions
    case debts
    case jointChecks

    var id: String { rawValue }

    var title: String {
        switch self {
        case .goals: return "Цілі"
        case .subscriptions: return "Підписки"
        case .debts: return "Борги"
        case .jointChecks: return "Спільні чеки"
        }
    }

    var icon: String {
        switch self {
        case .goals: return "target"
        case .subscriptions: return "arrow.triangle.2.circlepath"
        case .debts: return "person.2.fill"
        case .jointChecks: return "list.dash.header.rectangle"
        }
    }

    var tint: Color {
        switch self {
        case .goals: return Theme.Palette.mint
        case .subscriptions: return Theme.Palette.violet
        case .debts: return Theme.Palette.amber
        case .jointChecks: return Theme.Palette.cyan
        }
    }
}

struct FinancialHubView: View {
    @State private var section: HubSection = .goals

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                header
                sectionPicker

                Group {
                    switch section {
                    case .goals: GoalsSection()
                    case .subscriptions: SubscriptionsSection()
                    case .debts: DebtsSection()
                    case .jointChecks: JointChecksSection()
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))

                Color.clear.frame(height: 100)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Фінанси")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(.white)
            Text("Цілі, підписки, борги та спільні чеки")
                .font(Theme.Typography.footnote)
                .foregroundStyle(Theme.Palette.tertiaryText)
        }
    }

    private var sectionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HubSection.allCases) { s in
                    Button {
                        HapticFeedback.selection()
                        withAnimation(Theme.Motion.snappy) {
                            section = s
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: s.icon)
                                .font(.system(size: 12, weight: .bold))
                            Text(s.title)
                                .font(Theme.Typography.footnote.weight(.semibold))
                        }
                        .foregroundStyle(section == s ? .white : Theme.Palette.secondaryText)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)
                    .liquidGlass(
                        tint: section == s ? s.tint.opacity(0.35) : .white.opacity(0.05),
                        interactive: true,
                        in: Capsule()
                    )
                }
            }
        }
    }
}

struct GoalsSection: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingCreate = false
    @State private var topupGoal: SmartGoal?

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\(store.settings.smartGoals.count) цілей")
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Spacer()
                GlassButton(title: "Додати ціль", icon: "plus", tint: Theme.Palette.mint, prominent: true) {
                    showingCreate = true
                }
                .frame(width: 180)
            }

            if store.settings.smartGoals.isEmpty {
                EmptyStateCard(icon: "target", title: "Немає цілей", subtitle: "Створіть першу фінансову ціль")
            } else {
                ForEach(store.settings.smartGoals) { goal in
                    GoalCard(goal: goal) {
                        topupGoal = goal
                    }
                    .contextMenu {
                        Button(role: .destructive) {
                            store.removeGoal(goal)
                        } label: {
                            Label("Видалити", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingCreate) {
            GoalCreateSheet().environmentObject(store)
                .presentationDetents([.medium])
                .presentationBackground(.clear)
        }
        .sheet(item: $topupGoal) { goal in
            GoalTopUpSheet(goal: goal).environmentObject(store)
                .presentationDetents([.height(280)])
                .presentationBackground(.clear)
        }
    }
}

struct GoalCard: View {
    @EnvironmentObject private var store: AppStore
    let goal: SmartGoal
    let onTopUp: () -> Void

    var body: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 16, tint: Theme.Palette.mint.opacity(0.1)) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Theme.Palette.mint.opacity(0.25)).frame(width: 46, height: 46)
                        Text(goal.emoji).font(.system(size: 22))
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(goal.title)
                            .font(Theme.Typography.headline)
                            .foregroundStyle(.white)
                        if let due = goal.dueDate {
                            Text("До \(AppLocale.mediumDateFormatter.string(from: due))")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Palette.tertiaryText)
                        }
                    }
                    Spacer()
                    Button {
                        HapticFeedback.tap()
                        onTopUp()
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .bold))
                            .frame(width: 32, height: 32)
                            .foregroundStyle(.white)
                            .background(Theme.Palette.mint, in: Circle())
                    }
                    .buttonStyle(.plain)
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(store.formatted(goal.savedAmount, currency: goal.currency))
                            .font(Theme.Typography.title2.weight(.bold))
                            .foregroundStyle(.white)
                        Text("/ \(store.formatted(goal.targetAmount, currency: goal.currency))")
                            .font(Theme.Typography.footnote)
                            .foregroundStyle(Theme.Palette.tertiaryText)
                        Spacer()
                        Text("\(Int(goal.progress * 100))%")
                            .font(Theme.Typography.headline.weight(.bold))
                            .foregroundStyle(Theme.Palette.mint)
                    }
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.1))
                            Capsule()
                                .fill(Theme.Gradient.incomeGlow)
                                .frame(width: max(6, proxy.size.width * goal.progress))
                        }
                    }
                    .frame(height: 8)
                }
            }
        }
    }
}

struct GoalCreateSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var target = ""
    @State private var saved = ""
    @State private var emoji = "🎯"
    @State private var dueDate = Calendar.current.date(byAdding: .month, value: 6, to: .now) ?? .now
    @State private var includeDate = false

    private let emojiOptions = ["🎯", "💻", "🏠", "🚗", "✈️", "💍", "📚", "🎁", "💰", "📱"]

    var body: some View {
        ZStack {
            AppBackground(palette: .oceanDeep)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Нова ціль")
                            .font(Theme.Typography.title)
                            .foregroundStyle(.white)
                        Spacer()
                        GlassIconButton(systemImage: "xmark") { dismiss() }
                    }

                    emojiPicker
                    field("Назва цілі", text: $title)
                    HStack(spacing: 10) {
                        amountField(text: $target, placeholder: "Ціль")
                        amountField(text: $saved, placeholder: "Зібрано")
                    }
                    Toggle("Встановити дату", isOn: $includeDate)
                        .foregroundStyle(.white)
                        .tint(Theme.Palette.mint)
                    if includeDate {
                        DatePicker("Дата", selection: $dueDate, displayedComponents: .date)
                            .environment(\.locale, AppLocale.locale)
                            .datePickerStyle(.compact)
                            .colorScheme(.dark)
                    }

                    Button(action: save) {
                        Text("Створити")
                            .font(Theme.Typography.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.Gradient.primaryButton)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                }
                .padding(18)
            }
        }
    }

    private var emojiPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(emojiOptions, id: \.self) { e in
                    Button {
                        emoji = e
                    } label: {
                        Text(e)
                            .font(.system(size: 26))
                            .frame(width: 50, height: 50)
                    }
                    .buttonStyle(.plain)
                    .liquidGlass(
                        tint: emoji == e ? Theme.Palette.mint.opacity(0.4) : .white.opacity(0.06),
                        interactive: true,
                        in: Circle()
                    )
                }
            }
        }
    }

    private func field(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .font(Theme.Typography.callout)
            .foregroundStyle(.white)
            .tint(Theme.Palette.mint)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private func amountField(text: Binding<String>, placeholder: String) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(.decimalPad)
            .font(Theme.Typography.callout)
            .foregroundStyle(.white)
            .tint(Theme.Palette.mint)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private func save() {
        let t = Double(target.replacingOccurrences(of: ",", with: ".")) ?? 0
        let s = Double(saved.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !title.isEmpty, t > 0 else {
            HapticFeedback.warning()
            return
        }
        store.addGoal(title: title, targetAmount: t, savedAmount: s, dueDate: includeDate ? dueDate : nil, emoji: emoji)
        HapticFeedback.success()
        dismiss()
    }
}

struct GoalTopUpSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let goal: SmartGoal
    @State private var amount = ""

    var body: some View {
        ZStack {
            AppBackground(palette: .oceanDeep)
            VStack(spacing: 16) {
                HStack {
                    Text("Поповнити \"\(goal.title)\"")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    Spacer()
                    GlassIconButton(systemImage: "xmark") { dismiss() }
                }

                TextField("Сума", text: $amount)
                    .keyboardType(.decimalPad)
                    .font(Theme.Typography.title)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .liquidGlass(tint: .white.opacity(0.05), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
                    .tint(Theme.Palette.mint)

                Button {
                    let value = Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
                    store.topUpGoal(goal, amount: value)
                    HapticFeedback.success()
                    dismiss()
                } label: {
                    Text("Додати")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.Gradient.incomeGlow)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(18)
        }
    }
}

struct SubscriptionsSection: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingCreate = false

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\(store.settings.subscriptions.filter { $0.isActive }.count) активних")
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Spacer()
                GlassButton(title: "Додати підписку", icon: "plus", tint: Theme.Palette.violet, prominent: true) {
                    showingCreate = true
                }
                .frame(width: 200)
            }

            if store.settings.subscriptions.isEmpty {
                EmptyStateCard(icon: "arrow.triangle.2.circlepath", title: "Немає підписок", subtitle: "Додайте Netflix, Spotify чи свою послугу")
            } else {
                ForEach(store.settings.subscriptions) { sub in
                    SubscriptionCard(sub: sub)
                        .contextMenu {
                            Button {
                                store.toggleSubscriptionActive(sub)
                            } label: {
                                Label(sub.isActive ? "Призупинити" : "Відновити",
                                      systemImage: sub.isActive ? "pause.fill" : "play.fill")
                            }
                            Button(role: .destructive) {
                                store.removeSubscription(sub)
                            } label: {
                                Label("Видалити", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .sheet(isPresented: $showingCreate) {
            SubscriptionCreateSheet().environmentObject(store)
                .presentationDetents([.large])
                .presentationBackground(.clear)
        }
    }
}

struct SubscriptionCard: View {
    @EnvironmentObject private var store: AppStore
    let sub: SubscriptionItem

    private var color: Color {
        if let hex = UInt(sub.color, radix: 16) {
            return Color(hex: hex)
        }
        return Theme.Palette.violet
    }

    var body: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: color.opacity(0.12)) {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(color.opacity(0.3)).frame(width: 46, height: 46)
                    Image(systemName: sub.icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(sub.name)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text(sub.period.title)
                        Text("·")
                        Text("До \(AppLocale.mediumDateFormatter.string(from: sub.nextDate))")
                    }
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(store.formatted(sub.amount, currency: sub.currency))
                        .font(Theme.Typography.headline.weight(.bold))
                        .foregroundStyle(.white)
                    if !sub.isActive {
                        Text("ПАУЗА")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Theme.Palette.amber)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.Palette.amber.opacity(0.18), in: Capsule())
                    }
                }
            }
        }
        .opacity(sub.isActive ? 1.0 : 0.6)
    }
}

struct SubscriptionCreateSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPreset: SubscriptionPreset?
    @State private var customName = ""
    @State private var amount = ""
    @State private var currency: CurrencyCode = .eur
    @State private var period: SubscriptionPeriod = .monthly
    @State private var nextDate = Calendar.current.date(byAdding: .month, value: 1, to: .now) ?? .now

    var body: some View {
        ZStack {
            AppBackground(palette: .auroraNight)
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Нова підписка")
                            .font(Theme.Typography.title)
                            .foregroundStyle(.white)
                        Spacer()
                        GlassIconButton(systemImage: "xmark") { dismiss() }
                    }

                    Text("Оберіть сервіс")
                        .font(Theme.Typography.caption.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(Theme.Palette.tertiaryText)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(subscriptionPresets) { preset in
                            presetTile(preset)
                        }
                    }

                    if selectedPreset?.id == "custom" {
                        TextField("Назва", text: $customName)
                            .font(Theme.Typography.callout)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
                    }

                    HStack(spacing: 10) {
                        TextField("Сума", text: $amount)
                            .keyboardType(.decimalPad)
                            .font(Theme.Typography.callout)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                        ForEach(CurrencyCode.allCases) { code in
                            GlassChip(title: code.symbol, isSelected: currency == code, tint: code.accent) {
                                currency = code
                            }
                        }
                    }

                    HStack(spacing: 8) {
                        ForEach(SubscriptionPeriod.allCases) { p in
                            GlassChip(title: p.title, isSelected: period == p, tint: Theme.Palette.violet) {
                                period = p
                            }
                        }
                    }

                    DatePicker("Наступний платіж", selection: $nextDate, displayedComponents: .date)
                        .environment(\.locale, AppLocale.locale)
                        .datePickerStyle(.compact)
                        .colorScheme(.dark)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                    Button(action: save) {
                        Text("Створити")
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
                .padding(18)
            }
        }
        .onAppear {
            currency = store.settings.mainCurrency
        }
    }

    private func presetTile(_ preset: SubscriptionPreset) -> some View {
        Button {
            HapticFeedback.selection()
            selectedPreset = preset
            if preset.id != "custom" {
                customName = preset.name
                amount = String(format: "%.2f", preset.suggestedAmount)
                currency = preset.suggestedCurrency
            } else {
                customName = ""
                amount = ""
            }
        } label: {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(preset.color.opacity(0.25))
                        .frame(width: 42, height: 42)
                    Image(systemName: preset.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text(preset.name)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .liquidGlass(
            tint: selectedPreset?.id == preset.id ? preset.color.opacity(0.25) : .white.opacity(0.04),
            interactive: true,
            in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
        )
    }

    private func save() {
        let amt = Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
        let name = customName.isEmpty ? (selectedPreset?.name ?? "Підписка") : customName
        let icon = selectedPreset?.icon ?? "arrow.triangle.2.circlepath"
        let colorHex = selectedPreset?.colorHex ?? 0x7C3AED
        let categoryId = selectedPreset?.categoryId ?? "subscriptions"
        guard amt > 0 else {
            HapticFeedback.warning()
            return
        }
        store.addSubscription(name: name, amount: amt, currency: currency, category: categoryId, icon: icon, colorHex: colorHex, period: period, nextDate: nextDate)
        HapticFeedback.success()
        dismiss()
    }
}

struct DebtsSection: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingCreate = false

    private var owedToMe: Double {
        store.settings.debts.filter { !$0.isPaid && $0.direction == .owedToMe }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    private var iOwe: Double {
        store.settings.debts.filter { !$0.isPaid && $0.direction == .iOwe }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                summaryCard(title: "Мені винні", value: owedToMe, tint: Theme.Palette.mint)
                summaryCard(title: "Я винен", value: iOwe, tint: Theme.Palette.rose)
            }

            HStack {
                Spacer()
                GlassButton(title: "Додати борг", icon: "plus", tint: Theme.Palette.amber, prominent: true) {
                    showingCreate = true
                }
                .frame(width: 180)
            }

            if store.settings.debts.isEmpty {
                EmptyStateCard(icon: "person.2", title: "Боргів немає", subtitle: "Додайте борг, щоб не забути")
            } else {
                ForEach(store.settings.debts) { debt in
                    DebtCard(debt: debt)
                        .contextMenu {
                            Button {
                                store.toggleDebtPaid(debt)
                            } label: {
                                Label(debt.isPaid ? "Відновити" : "Позначити сплаченим",
                                      systemImage: debt.isPaid ? "arrow.uturn.backward" : "checkmark")
                            }
                            Button(role: .destructive) {
                                store.removeDebt(debt)
                            } label: {
                                Label("Видалити", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .sheet(isPresented: $showingCreate) {
            DebtCreateSheet().environmentObject(store)
                .presentationDetents([.medium])
                .presentationBackground(.clear)
        }
    }

    private func summaryCard(title: String, value: Double, tint: Color) -> some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: tint.opacity(0.15)) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Text(store.formatted(value))
                    .font(Theme.Typography.title2.weight(.bold))
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

struct DebtCard: View {
    @EnvironmentObject private var store: AppStore
    let debt: DebtItem

    var body: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: debt.direction.tint.opacity(0.1)) {
            HStack(spacing: 12) {
                Image(systemName: debt.direction.icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(debt.direction.tint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(debt.person)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                        .strikethrough(debt.isPaid)
                    Text(debt.direction.title)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    if let due = debt.dueDate {
                        Text("До \(AppLocale.mediumDateFormatter.string(from: due))")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Palette.tertiaryText)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(store.formatted(debt.amount, currency: debt.currency))
                        .font(Theme.Typography.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .strikethrough(debt.isPaid)
                    if debt.isPaid {
                        Text("СПЛАЧЕНО")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Theme.Palette.mint)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.Palette.mint.opacity(0.18), in: Capsule())
                    }
                }
            }
        }
        .opacity(debt.isPaid ? 0.6 : 1.0)
    }
}

struct DebtCreateSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var person = ""
    @State private var amount = ""
    @State private var currency: CurrencyCode = .eur
    @State private var direction: DebtDirection = .owedToMe
    @State private var note = ""
    @State private var includeDate = false
    @State private var dueDate = Calendar.current.date(byAdding: .day, value: 14, to: .now) ?? .now

    var body: some View {
        ZStack {
            AppBackground(palette: .sunsetPeach)
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Новий борг")
                            .font(Theme.Typography.title)
                            .foregroundStyle(.white)
                        Spacer()
                        GlassIconButton(systemImage: "xmark") { dismiss() }
                    }

                    HStack(spacing: 8) {
                        ForEach(DebtDirection.allCases) { d in
                            GlassChip(title: d.title, isSelected: direction == d, tint: d.tint) {
                                direction = d
                            }
                        }
                    }

                    TextField("Ім'я", text: $person)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                    HStack(spacing: 10) {
                        TextField("Сума", text: $amount)
                            .keyboardType(.decimalPad)
                            .font(Theme.Typography.callout)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                        ForEach(CurrencyCode.allCases) { code in
                            GlassChip(title: code.symbol, isSelected: currency == code, tint: code.accent) {
                                currency = code
                            }
                        }
                    }

                    TextField("Примітка", text: $note)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                    Toggle("Встановити дату", isOn: $includeDate)
                        .foregroundStyle(.white)
                        .tint(Theme.Palette.amber)
                    if includeDate {
                        DatePicker("Повернути до", selection: $dueDate, displayedComponents: .date)
                            .environment(\.locale, AppLocale.locale)
                            .datePickerStyle(.compact)
                            .colorScheme(.dark)
                    }

                    Button {
                        let amt = Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
                        guard !person.isEmpty, amt > 0 else {
                            HapticFeedback.warning()
                            return
                        }
                        store.addDebt(person: person, amount: amt, currency: currency, dueDate: includeDate ? dueDate : nil, direction: direction, note: note)
                        HapticFeedback.success()
                        dismiss()
                    } label: {
                        Text("Створити")
                            .font(Theme.Typography.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.Gradient.primaryButton)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(18)
            }
        }
        .onAppear { currency = store.settings.mainCurrency }
    }
}

struct JointChecksSection: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingCreate = false

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\(store.settings.jointChecks.count) чеків")
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Spacer()
                GlassButton(title: "Створити", icon: "plus", tint: Theme.Palette.cyan, prominent: true) {
                    showingCreate = true
                }
                .frame(width: 180)
            }

            if store.settings.jointChecks.isEmpty {
                EmptyStateCard(icon: "list.dash.header.rectangle", title: "Спільних чеків немає", subtitle: "Розділіть рахунок з друзями")
            } else {
                ForEach(store.settings.jointChecks) { check in
                    JointCheckCard(check: check)
                        .contextMenu {
                            if !check.isClosed {
                                Button {
                                    store.closeJointCheck(check)
                                } label: {
                                    Label("Закрити", systemImage: "checkmark.circle")
                                }
                            }
                            Button(role: .destructive) {
                                store.removeJointCheck(check)
                            } label: {
                                Label("Видалити", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .sheet(isPresented: $showingCreate) {
            JointCheckCreateSheet().environmentObject(store)
                .presentationDetents([.large])
                .presentationBackground(.clear)
        }
    }
}

struct JointCheckCard: View {
    @EnvironmentObject private var store: AppStore
    let check: JointCheck

    var body: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 16, tint: Theme.Palette.cyan.opacity(0.1)) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: "list.dash.header.rectangle")
                        .font(.system(size: 18))
                        .foregroundStyle(Theme.Palette.cyan)
                    Text(check.title)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    Spacer()
                    if check.isClosed {
                        Text("ЗАКРИТО")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Theme.Palette.mutedText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.white.opacity(0.1), in: Capsule())
                    }
                }

                Text("\(check.participants.count) учасників")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)

                HStack {
                    Text(store.formatted(check.totalPaid, currency: check.currency))
                        .font(Theme.Typography.headline.weight(.bold))
                        .foregroundStyle(.white)
                    Text("/ \(store.formatted(check.totalAmount, currency: check.currency))")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    Spacer()
                    Text("\(Int(check.progress * 100))%")
                        .font(Theme.Typography.headline.weight(.bold))
                        .foregroundStyle(Theme.Palette.cyan)
                }

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.1))
                        Capsule()
                            .fill(LinearGradient(colors: [Theme.Palette.cyan, Theme.Palette.mint], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(6, proxy.size.width * check.progress))
                    }
                }
                .frame(height: 6)
            }
        }
    }
}

struct JointCheckCreateSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var total = ""
    @State private var currency: CurrencyCode = .eur
    @State private var participants: [JointCheckParticipant] = [
        .init(name: "Я", share: 1)
    ]
    @State private var newParticipant = ""

    var body: some View {
        ZStack {
            AppBackground(palette: .oceanDeep)
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Спільний чек")
                            .font(Theme.Typography.title)
                            .foregroundStyle(.white)
                        Spacer()
                        GlassIconButton(systemImage: "xmark") { dismiss() }
                    }

                    TextField("Назва (напр. Вечеря)", text: $title)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                    HStack(spacing: 10) {
                        TextField("Загальна сума", text: $total)
                            .keyboardType(.decimalPad)
                            .font(Theme.Typography.callout)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                        ForEach(CurrencyCode.allCases) { code in
                            GlassChip(title: code.symbol, isSelected: currency == code, tint: code.accent) {
                                currency = code
                            }
                        }
                    }

                    Text("УЧАСНИКИ (\(participants.count))")
                        .font(Theme.Typography.caption.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(Theme.Palette.tertiaryText)

                    VStack(spacing: 8) {
                        ForEach(participants) { p in
                            HStack {
                                Image(systemName: "person.fill")
                                    .foregroundStyle(Theme.Palette.cyan)
                                Text(p.name)
                                    .font(Theme.Typography.callout)
                                    .foregroundStyle(.white)
                                Spacer()
                                if participants.count > 1 {
                                    Button {
                                        participants.removeAll { $0.id == p.id }
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(Theme.Palette.rose)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Додати учасника", text: $newParticipant)
                            .font(Theme.Typography.callout)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

                        Button {
                            let name = newParticipant.trimmingCharacters(in: .whitespaces)
                            guard !name.isEmpty else { return }
                            participants.append(.init(name: name, share: 1))
                            newParticipant = ""
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                                .background(Theme.Palette.cyan, in: Circle())
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        let amt = Double(total.replacingOccurrences(of: ",", with: ".")) ?? 0
                        guard !title.isEmpty, amt > 0, !participants.isEmpty else {
                            HapticFeedback.warning()
                            return
                        }
                        _ = store.addJointCheck(title: title, totalAmount: amt, currency: currency, participants: participants)
                        HapticFeedback.success()
                        dismiss()
                    } label: {
                        Text("Створити")
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
                .padding(18)
            }
        }
        .onAppear { currency = store.settings.mainCurrency }
    }
}
