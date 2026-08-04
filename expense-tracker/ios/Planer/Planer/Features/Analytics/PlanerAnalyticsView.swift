import SwiftUI

private enum AnalyticsPeriod: String, CaseIterable, Identifiable {
    case week
    case month
    case year
    case all
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .week: "Тиждень"
        case .month: "Місяць"
        case .year: "Рік"
        case .all: "Увесь час"
        case .custom: "Власний період"
        }
    }
}

private enum AnalyticsOperationFilter: String, CaseIterable, Identifiable {
    case all
    case expenses
    case income
    case transfers

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "Усі операції"
        case .expenses: "Витрати"
        case .income: "Доходи"
        case .transfers: "Перекази"
        }
    }

    func includes(_ transaction: FinanceTransaction) -> Bool {
        switch self {
        case .all: true
        case .expenses: transaction.kind == .expense
        case .income: transaction.kind == .income
        case .transfers: transaction.kind == .transfer
        }
    }
}

private struct AnalyticsFilters: Identifiable {
    var id: String { "analytics-filters" }

    var period: AnalyticsPeriod = .month
    var operation: AnalyticsOperationFilter = .all
    var walletID: UUID?
    var category: TransactionCategory?
    var customStart = Calendar.current.date(byAdding: .month, value: -1, to: .now) ?? .now
    var customEnd = Date.now

    var activeCount: Int {
        var count = period == .month ? 0 : 1
        if operation != .all { count += 1 }
        if walletID != nil { count += 1 }
        if category != nil { count += 1 }
        return count
    }
}

struct PlanerAnalyticsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppRouter.self) private var router

    @State private var filters = AnalyticsFilters()
    @State private var filterDraft: AnalyticsFilters?

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                LazyVStack(spacing: 16) {
                    filterSummary

                    if filteredTransactions.isEmpty {
                        ContentUnavailableView(
                            "Немає даних за цими фільтрами",
                            systemImage: "chart.bar.xaxis",
                            description: Text("Змініть період, гаманець або тип операції")
                        )
                        .frame(minHeight: 320)
                        .contentCard()
                    } else {
                        summaryGrid
                        timelineCard
                        detailedMetricsCard
                        categoriesCard
                        walletsCard
                        operationsCard
                    }
                }
                .padding(18)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Аналітика")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    filterDraft = filters
                } label: {
                    Image(
                        systemName: filters.activeCount > 0
                            ? "line.3.horizontal.decrease.circle.fill"
                            : "line.3.horizontal.decrease.circle"
                    )
                }
                .accessibilityLabel("Налаштувати аналітику")
            }
        }
        .sheet(item: $filterDraft) { draft in
            NavigationStack {
                AnalyticsFilterView(initialFilters: draft) { updatedFilters in
                    filters = updatedFilters
                }
            }
        }
    }

    private var filteredTransactions: [FinanceTransaction] {
        store.transactions
            .filter { transaction in
                matchesPeriod(transaction.date)
                    && filters.operation.includes(transaction)
                    && matchesWallet(transaction)
                    && (filters.category == nil || transaction.category == filters.category)
            }
            .sorted { $0.date > $1.date }
    }

    private var expenseTransactions: [FinanceTransaction] {
        filteredTransactions.filter { $0.kind == .expense }
    }

    private var expenseTotal: Double {
        total(for: .expense)
    }

    private var incomeTotal: Double {
        total(for: .income)
    }

    private var netTotal: Double {
        incomeTotal - expenseTotal
    }

    private var filterSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Поточний зріз")
                        .font(.headline)
                    Text(periodDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Змінити") {
                    filterDraft = filters
                }
                .controlSize(.small)
                .planerProminentButton()
            }

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    AnalyticsFilterPill(title: filters.operation.title, icon: "arrow.left.arrow.right")
                    if let walletID = filters.walletID, let wallet = store.wallet(id: walletID) {
                        AnalyticsFilterPill(title: wallet.name, icon: "wallet.bifold")
                    }
                    if let category = filters.category {
                        AnalyticsFilterPill(title: category.title, icon: category.systemImage, tint: category.tint)
                    }
                    AnalyticsFilterPill(
                        title: "\(filteredTransactions.count) операцій",
                        icon: "number"
                    )
                }
            }
            .scrollIndicators(.hidden)
        }
        .padding(16)
        .contentCard()
    }

    private var summaryGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
            spacing: 12
        ) {
            AnalyticsSummaryCard(
                title: "Доходи",
                value: store.mainCurrency.formatted(incomeTotal),
                tint: PlanerTheme.positive,
                icon: "arrow.down.left"
            )
            AnalyticsSummaryCard(
                title: "Витрати",
                value: store.mainCurrency.formatted(expenseTotal),
                tint: PlanerTheme.negative,
                icon: "arrow.up.right"
            )
            AnalyticsSummaryCard(
                title: "Чистий результат",
                value: store.mainCurrency.formatted(netTotal),
                tint: netTotal >= 0 ? PlanerTheme.positive : PlanerTheme.negative,
                icon: "equal.circle.fill"
            )
            AnalyticsSummaryCard(
                title: "Операції",
                value: "\(filteredTransactions.count)",
                tint: PlanerTheme.accent,
                icon: "list.number"
            )
        }
    }

    private var timelineCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(timelineTitle)
                        .font(.headline)
                    Text("Натисніть фільтри, щоб змінити деталізацію")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chart.bar.xaxis")
                    .foregroundStyle(timelineTint)
            }

            AnalyticsBars(buckets: timelineBuckets, tint: timelineTint)
                .frame(height: 164)
        }
        .padding(16)
        .contentCard()
    }

    private var detailedMetricsCard: some View {
        let largestExpense = expenseTransactions.max {
            convertedAmount($0) < convertedAmount($1)
        }
        let activeDays = Set(
            filteredTransactions.map { Calendar.current.startOfDay(for: $0.date) }
        ).count
        let averageExpense = expenseTransactions.isEmpty
            ? 0
            : expenseTotal / Double(expenseTransactions.count)

        return VStack(alignment: .leading, spacing: 0) {
            Text("Детальні показники")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

            DetailMetricRow(
                title: "Середня витрата",
                value: store.mainCurrency.formatted(averageExpense),
                icon: "divide.circle.fill",
                tint: PlanerTheme.warning
            )
            Divider().padding(.leading, 56)
            DetailMetricRow(
                title: "Найбільша витрата",
                value: largestExpense.map { store.mainCurrency.formatted(convertedAmount($0)) } ?? "—",
                detail: largestExpense.map { $0.note.isEmpty ? $0.category.title : $0.note },
                icon: "arrow.up.right.circle.fill",
                tint: PlanerTheme.negative
            )
            Divider().padding(.leading, 56)
            DetailMetricRow(
                title: "Активні дні",
                value: "\(activeDays)",
                icon: "calendar.circle.fill",
                tint: PlanerTheme.accent
            )
        }
        .contentCard()
    }

    private var categoriesCard: some View {
        let rows = store.categoryTotals(for: filteredTransactions)
        let maxValue = rows.first?.amount ?? 1

        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Категорії витрат")
                    .font(.headline)
                Spacer()
                Text("Натисніть для фільтра")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            if rows.isEmpty {
                ContentUnavailableView("Немає витрат", systemImage: "chart.pie")
                    .frame(minHeight: 170)
            } else {
                ForEach(rows) { row in
                    Button {
                        filters.category = filters.category == row.category ? nil : row.category
                    } label: {
                        VStack(spacing: 8) {
                            HStack(spacing: 10) {
                                Image(systemName: row.category.systemImage)
                                    .foregroundStyle(row.category.tint)
                                    .frame(width: 30, height: 30)
                                    .background(row.category.tint.opacity(0.14), in: Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.category.title)
                                        .font(.subheadline.weight(.medium))
                                    Text(categoryPercentage(row.amount))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(store.mainCurrency.formatted(row.amount))
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                            }
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(Color.secondary.opacity(0.14))
                                    .overlay(alignment: .leading) {
                                        Capsule()
                                            .fill(row.category.tint.gradient)
                                            .frame(width: proxy.size.width * max(0.04, row.amount / maxValue))
                                    }
                            }
                            .frame(height: 5)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if row.id != rows.last?.id { Divider().padding(.leading, 56) }
                }
            }
        }
        .contentCard()
    }

    private var walletsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("За гаманцями")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

            ForEach(walletRows) { row in
                VStack(spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.wallet.name)
                                .font(.subheadline.weight(.semibold))
                            Text("\(row.count) операцій")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("+\(store.mainCurrency.formatted(row.income))")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(PlanerTheme.positive)
                            Text("−\(store.mainCurrency.formatted(row.expenses))")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(PlanerTheme.negative)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                if row.id != walletRows.last?.id { Divider().padding(.leading, 16) }
            }
        }
        .contentCard()
    }

    private var operationsCard: some View {
        let rows = Array(filteredTransactions.prefix(100))

        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Усі деталі")
                    .font(.headline)
                Spacer()
                Text("\(filteredTransactions.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            ForEach(rows) { transaction in
                Button {
                    router.presentedSheet = .transaction(transaction)
                } label: {
                    TransactionRowView(transaction: transaction)
                }
                .buttonStyle(.plain)

                if transaction.id != rows.last?.id {
                    Divider().padding(.leading, 62)
                }
            }

            if filteredTransactions.count > rows.count {
                Text("Показано перші 100 операцій. Звузьте фільтри, щоб побачити потрібну операцію.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(16)
            }
        }
        .padding(.bottom, 8)
        .contentCard()
    }

    private var walletRows: [WalletAnalyticsRow] {
        store.wallets.compactMap { wallet in
            let transactions = filteredTransactions.filter { $0.walletID == wallet.id }
            guard !transactions.isEmpty else { return nil }
            let expenses = transactions.filter { $0.kind == .expense }.reduce(0) {
                $0 + convertedAmount($1)
            }
            let income = transactions.filter { $0.kind == .income }.reduce(0) {
                $0 + convertedAmount($1)
            }
            return WalletAnalyticsRow(
                wallet: wallet,
                expenses: expenses,
                income: income,
                count: transactions.count
            )
        }
    }

    private var periodDescription: String {
        if filters.period == .custom {
            return "\(filters.customStart.formatted(date: .abbreviated, time: .omitted)) — \(filters.customEnd.formatted(date: .abbreviated, time: .omitted))"
        }
        return filters.period.title
    }

    private func matchesPeriod(_ date: Date) -> Bool {
        let calendar = Calendar.current
        let start: Date
        let end: Date

        switch filters.period {
        case .week:
            start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: .now)) ?? .distantPast
            end = .now
        case .month:
            start = calendar.date(from: calendar.dateComponents([.year, .month], from: .now)) ?? .distantPast
            end = .now
        case .year:
            start = calendar.date(from: calendar.dateComponents([.year], from: .now)) ?? .distantPast
            end = .now
        case .all:
            return true
        case .custom:
            start = calendar.startOfDay(for: min(filters.customStart, filters.customEnd))
            let lastDay = calendar.startOfDay(for: max(filters.customStart, filters.customEnd))
            end = calendar.date(byAdding: .day, value: 1, to: lastDay)?.addingTimeInterval(-0.001) ?? lastDay
        }
        return date >= start && date <= end
    }

    private func matchesWallet(_ transaction: FinanceTransaction) -> Bool {
        guard let walletID = filters.walletID else { return true }
        return transaction.walletID == walletID || transaction.destinationWalletID == walletID
    }

    private func total(for kind: FinanceTransactionKind) -> Double {
        filteredTransactions.filter { $0.kind == kind }.reduce(0) {
            $0 + convertedAmount($1)
        }
    }

    private func convertedAmount(_ transaction: FinanceTransaction) -> Double {
        store.converted(transaction.amount, from: transaction.currency, to: store.mainCurrency)
    }

    private func categoryPercentage(_ amount: Double) -> String {
        guard expenseTotal > 0 else { return "0%" }
        return "\(Int((amount / expenseTotal * 100).rounded()))% витрат"
    }

    private var timelineTitle: String {
        switch filters.operation {
        case .income: "Динаміка доходів"
        case .transfers: "Динаміка переказів"
        case .all, .expenses: "Динаміка витрат"
        }
    }

    private var timelineTint: Color {
        switch filters.operation {
        case .income: PlanerTheme.positive
        case .transfers: PlanerTheme.accent
        case .all, .expenses: PlanerTheme.negative
        }
    }

    private var timelineBuckets: [AnalyticsBucket] {
        let source: [FinanceTransaction]
        switch filters.operation {
        case .income:
            source = filteredTransactions.filter { $0.kind == .income }
        case .transfers:
            source = filteredTransactions.filter { $0.kind == .transfer }
        case .all, .expenses:
            source = filteredTransactions.filter { $0.kind == .expense }
        }

        guard !filteredTransactions.isEmpty else { return [] }
        let calendar = Calendar.current
        let bounds = timelineBounds
        let days = max(1, calendar.dateComponents([.day], from: bounds.start, to: bounds.end).day ?? 1)
        let unit: TimelineUnit
        if days <= 45 {
            unit = .day
        } else if days <= 240 {
            unit = .week
        } else if days <= 1_500 {
            unit = .month
        } else {
            unit = .year
        }

        var buckets: [AnalyticsBucket] = []
        var cursor = unit.alignedStart(for: bounds.start, calendar: calendar)
        while cursor <= bounds.end, buckets.count < 80 {
            guard let next = unit.next(after: cursor, calendar: calendar) else { break }
            let amount = source
                .filter { $0.date >= cursor && $0.date < next }
                .reduce(0) { $0 + convertedAmount($1) }
            buckets.append(
                AnalyticsBucket(
                    date: cursor,
                    label: unit.label(for: cursor),
                    amount: amount
                )
            )
            cursor = next
        }
        return buckets
    }

    private var timelineBounds: DateInterval {
        let dates = filteredTransactions.map(\.date)
        let firstTransaction = dates.min() ?? .now
        let lastTransaction = dates.max() ?? .now
        let calendar = Calendar.current

        switch filters.period {
        case .week:
            return DateInterval(
                start: calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: .now)) ?? firstTransaction,
                end: .now
            )
        case .month:
            return DateInterval(
                start: calendar.date(from: calendar.dateComponents([.year, .month], from: .now)) ?? firstTransaction,
                end: .now
            )
        case .year:
            return DateInterval(
                start: calendar.date(from: calendar.dateComponents([.year], from: .now)) ?? firstTransaction,
                end: .now
            )
        case .all:
            return DateInterval(start: firstTransaction, end: max(lastTransaction, Date.now))
        case .custom:
            let start = calendar.startOfDay(for: min(filters.customStart, filters.customEnd))
            let endDay = calendar.startOfDay(for: max(filters.customStart, filters.customEnd))
            let end = calendar.date(byAdding: .day, value: 1, to: endDay)?.addingTimeInterval(-0.001) ?? endDay
            return DateInterval(start: start, end: end)
        }
    }
}

private struct AnalyticsFilterView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let onApply: (AnalyticsFilters) -> Void

    @State private var draft: AnalyticsFilters

    init(initialFilters: AnalyticsFilters, onApply: @escaping (AnalyticsFilters) -> Void) {
        self.onApply = onApply
        _draft = State(initialValue: initialFilters)
    }

    var body: some View {
        Form {
            Section("Період") {
                Picker("Період", selection: $draft.period) {
                    ForEach(AnalyticsPeriod.allCases) { period in
                        Text(period.title).tag(period)
                    }
                }

                if draft.period == .custom {
                    DatePicker("Від", selection: $draft.customStart, displayedComponents: .date)
                    DatePicker("До", selection: $draft.customEnd, displayedComponents: .date)
                }
            }

            Section("Операції") {
                Picker("Тип", selection: $draft.operation) {
                    ForEach(AnalyticsOperationFilter.allCases) { operation in
                        Text(operation.title).tag(operation)
                    }
                }

                Picker("Гаманець", selection: $draft.walletID) {
                    Text("Усі гаманці").tag(UUID?.none)
                    ForEach(store.wallets) { wallet in
                        Text(wallet.name).tag(Optional(wallet.id))
                    }
                }

                Picker("Категорія", selection: $draft.category) {
                    Text("Усі категорії").tag(TransactionCategory?.none)
                    ForEach(availableCategories) { category in
                        Label(category.title, systemImage: category.systemImage)
                            .tag(Optional(category))
                    }
                }
                .disabled(draft.operation == .transfers)
            }

            Section {
                Button("Скинути всі фільтри", role: .destructive) {
                    draft = AnalyticsFilters()
                }
            }
        }
        .navigationTitle("Налаштування аналітики")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Застосувати") {
                    if draft.operation == .transfers {
                        draft.category = nil
                    }
                    onApply(draft)
                    dismiss()
                }
            }
        }
        .onChange(of: draft.operation) { _, operation in
            if operation == .transfers {
                draft.category = nil
            }
        }
    }

    private var availableCategories: [TransactionCategory] {
        switch draft.operation {
        case .income:
            [.salary, .other]
        case .expenses:
            [.food, .transport, .home, .health, .shopping, .entertainment, .other]
        case .all:
            TransactionCategory.allCases.filter { $0 != .transfer }
        case .transfers:
            []
        }
    }
}

private struct AnalyticsFilterPill: View {
    let title: String
    let icon: String
    var tint: Color = PlanerTheme.accent

    var body: some View {
        Label(title, systemImage: icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(tint.opacity(0.12), in: Capsule())
    }
}

private struct AnalyticsSummaryCard: View {
    let title: String
    let value: String
    let tint: Color
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline.bold())
                .foregroundStyle(tint)
                .frame(width: 32, height: 32)
                .background(tint.opacity(0.14), in: Circle())
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .minimumScaleFactor(0.68)
                .lineLimit(1)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .contentCard()
    }
}

private struct DetailMetricRow: View {
    let title: String
    let value: String
    var detail: String? = nil
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 32, height: 32)
                .background(tint.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
    }
}

private struct AnalyticsBars: View {
    let buckets: [AnalyticsBucket]
    let tint: Color

    var body: some View {
        let maximum = max(buckets.map(\.amount).max() ?? 0, 1)

        ScrollView(.horizontal) {
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(buckets) { bucket in
                    VStack(spacing: 7) {
                        Text(bucket.amount > 0 ? compactAmount(bucket.amount) : "")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(height: 10)
                        Capsule()
                            .fill(tint.gradient)
                            .frame(height: max(5, 114 * bucket.amount / maximum))
                        Text(bucket.label)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(width: 34)
                }
            }
            .frame(minWidth: 300, minHeight: 154, alignment: .bottomLeading)
        }
        .scrollIndicators(.hidden)
    }

    private func compactAmount(_ amount: Double) -> String {
        if amount >= 1_000_000 { return String(format: "%.1fм", amount / 1_000_000) }
        if amount >= 1_000 { return String(format: "%.1fк", amount / 1_000) }
        return String(format: "%.0f", amount)
    }
}

private struct AnalyticsBucket: Identifiable {
    var id: Date { date }
    let date: Date
    let label: String
    let amount: Double
}

private struct WalletAnalyticsRow: Identifiable {
    var id: UUID { wallet.id }
    let wallet: Wallet
    let expenses: Double
    let income: Double
    let count: Int
}

private enum TimelineUnit {
    case day
    case week
    case month
    case year

    func alignedStart(for date: Date, calendar: Calendar) -> Date {
        switch self {
        case .day, .week:
            calendar.startOfDay(for: date)
        case .month:
            calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
        case .year:
            calendar.date(from: calendar.dateComponents([.year], from: date)) ?? date
        }
    }

    func next(after date: Date, calendar: Calendar) -> Date? {
        switch self {
        case .day: calendar.date(byAdding: .day, value: 1, to: date)
        case .week: calendar.date(byAdding: .day, value: 7, to: date)
        case .month: calendar.date(byAdding: .month, value: 1, to: date)
        case .year: calendar.date(byAdding: .year, value: 1, to: date)
        }
    }

    func label(for date: Date) -> String {
        switch self {
        case .day: date.formatted(.dateTime.day().month(.abbreviated))
        case .week: date.formatted(.dateTime.day().month(.abbreviated))
        case .month: date.formatted(.dateTime.month(.abbreviated))
        case .year: date.formatted(.dateTime.year())
        }
    }
}

#Preview("Analytics") {
    NavigationStack { PlanerAnalyticsView() }
        .environment(FinanceStore.previewStore())
        .environment(AppRouter())
        .preferredColorScheme(.dark)
}
