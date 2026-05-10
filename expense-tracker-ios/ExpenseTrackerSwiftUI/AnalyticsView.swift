import SwiftUI

private enum AnalyticsTab: String, CaseIterable, Identifiable {
    case overview
    case categories
    case trends
    case wallets

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct AnalyticsView: View {
    @EnvironmentObject private var store: AppStore

    @State private var selectedCurrency = "ALL"
    @State private var selectedRange: AnalyticsDateRange = .month
    @State private var selectedType: AnalyticsTypeFilter = .expense
    @State private var selectedTab: AnalyticsTab = .overview
    @State private var selectedCategory: String?

    private var availableCurrencies: [CurrencyCode] {
        let set = Set(store.transactions.map(\.currency))
        return CurrencyCode.allCases.filter { set.contains($0) || store.allWalletBalances[$0] != nil }
    }

    private var currencyFilter: CurrencyCode? {
        selectedCurrency == "ALL" ? nil : CurrencyCode(rawValue: selectedCurrency)
    }

    private var periodTransactions: [TransactionItem] {
        store.transactionsInRange(selectedRange, currencyFilter: currencyFilter, typeFilter: .all, categoryFilter: nil)
    }

    private var filteredTransactions: [TransactionItem] {
        store.transactionsInRange(selectedRange, currencyFilter: currencyFilter, typeFilter: selectedType, categoryFilter: selectedCategory)
    }

    private var previousTransactions: [TransactionItem] {
        let previous = previousRange(for: selectedRange)
        return store.transactions.filter { item in
            if item.excludedFromBalance { return false }
            if let currencyFilter, item.currency != currencyFilter { return false }
            return item.date >= previous.start && item.date <= previous.end
        }
    }

    private var totals: Totals {
        Totals(
            expenses: sum(periodTransactions, kind: .expense),
            income: sum(periodTransactions, kind: .income),
            previousExpenses: sum(previousTransactions, kind: .expense),
            previousIncome: sum(previousTransactions, kind: .income),
            transactionCount: periodTransactions.count
        )
    }

    private var categoryRows: [CategoryRow] {
        var dict: [String: CategoryRow] = [:]
        for item in periodTransactions where selectedType == .all || item.kind == selectedType.transactionKind {
            let key = item.kind == .income ? "income" : item.category
            let value = amountForView(item)
            let existing = dict[key] ?? CategoryRow(category: key, amount: 0, count: 0)
            dict[key] = CategoryRow(category: key, amount: existing.amount + value, count: existing.count + 1)
        }
        return dict.values.sorted { $0.amount > $1.amount }
    }

    private var trendRows: [TrendRow] {
        let calendar = Calendar.current
        let useMonths = selectedRange == .year || selectedRange == .all
        var map: [String: TrendRow] = [:]

        for item in filteredTransactions {
            let key: String
            let label: String
            if useMonths {
                let month = calendar.component(.month, from: item.date)
                let year = calendar.component(.year, from: item.date)
                key = "\(year)-\(month)"
                label = item.date.formatted(.dateTime.month(.abbreviated))
            } else {
                key = item.date.formatted(.dateTime.year().month().day())
                label = item.date.formatted(.dateTime.day().month(.twoDigits))
            }

            var row = map[key] ?? TrendRow(label: label, date: item.date, expense: 0, income: 0)
            if item.kind == .expense {
                row.expense += amountForView(item)
            } else {
                row.income += amountForView(item)
            }
            row.date = min(row.date, item.date)
            map[key] = row
        }

        return map.values.sorted { $0.date < $1.date }
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    rangeFilter
                    typeFilter
                    tabFilter

                    switch selectedTab {
                    case .overview:
                        overviewSection
                    case .categories:
                        categoriesSection(expanded: true)
                    case .trends:
                        trendsSection
                    case .wallets:
                        walletsSection
                    }

                    if periodTransactions.isEmpty {
                        Text("No transactions for this filter")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.66))
                            .glassCard(cornerRadius: 16)
                    }
                }
                .padding(18)
                .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Analytics")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.white)
                Text("Spending, income, trends, and wallet breakdown")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.66))
            }
            Spacer()
            Picker("Currency", selection: $selectedCurrency) {
                Text("All").tag("ALL")
                ForEach(availableCurrencies) { code in
                    Text(code.rawValue).tag(code.rawValue)
                }
            }
            .pickerStyle(.menu)
            .padding(8)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var rangeFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AnalyticsDateRange.allCases) { range in
                    filterPill(title: range.title, isActive: selectedRange == range) {
                        selectedRange = range
                    }
                }
            }
        }
    }

    private var typeFilter: some View {
        HStack(spacing: 8) {
            ForEach(AnalyticsTypeFilter.allCases) { type in
                filterPill(title: type.title, isActive: selectedType == type) {
                    selectedType = type
                    selectedCategory = nil
                }
            }
        }
    }

    private var tabFilter: some View {
        HStack(spacing: 8) {
            ForEach(AnalyticsTab.allCases) { tab in
                filterPill(title: tab.title, isActive: selectedTab == tab) {
                    selectedTab = tab
                }
            }
        }
    }

    private var overviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                metricCard(title: "Net", value: format(totals.net), detail: "vs prev \(percent(totals.netDelta))", accent: totals.net >= 0 ? .mint : .red)
                metricCard(title: "Expenses", value: format(totals.expenses), detail: selectedRange == .all ? "all time" : percent(totals.expensesDelta), accent: .white)
                metricCard(title: "Income", value: format(totals.income), detail: selectedRange == .all ? "all time" : percent(totals.incomeDelta), accent: .mint)
                metricCard(title: "Daily Avg", value: format(totals.dailyAverage), detail: "\(totals.transactionCount) tx", accent: .white)
            }

            categoriesSection(expanded: false)
            trendChart(limit: 14)
        }
    }

    private func categoriesSection(expanded: Bool) -> some View {
        let rows = expanded ? categoryRows : Array(categoryRows.prefix(5))
        let total = max(1, rows.reduce(0) { $0 + $1.amount })
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(expanded ? "All Categories" : "Top Categories")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                if selectedCategory != nil {
                    Button("Reset") {
                        selectedCategory = nil
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.mint)
                }
            }

            if rows.isEmpty {
                Text("No categories")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.66))
            } else {
                ForEach(rows) { row in
                    Button {
                        selectedCategory = selectedCategory == row.category ? nil : row.category
                    } label: {
                        HStack(spacing: 10) {
                            let category = resolvedCategory(for: row.category)
                            Image(systemName: row.category == "income" ? "arrow.down.left" : category.symbol)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(row.category == "income" ? .mint : category.color)
                                .frame(width: 30, height: 30)
                                .background(.white.opacity(0.08), in: Circle())

                            VStack(alignment: .leading, spacing: 3) {
                                Text(row.category == "income" ? "Income" : resolvedCategory(for: row.category).title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.white)
                                Text("\(row.count) tx")
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.62))
                            }

                            GeometryReader { proxy in
                                Capsule()
                                    .fill(.white.opacity(0.12))
                                    .overlay(alignment: .leading) {
                                        Capsule()
                                            .fill((row.category == "income" ? Color.mint : resolvedCategory(for: row.category).color).gradient)
                                            .frame(width: max(3, proxy.size.width * (row.amount / total)))
                                    }
                            }
                            .frame(height: 8)

                            Text(format(row.amount))
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white)
                        }
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .glassCard(cornerRadius: 18)
    }

    private var trendsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            trendChart(limit: trendRows.count)
            ForEach(trendRows.reversed()) { row in
                HStack {
                    Text(row.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                    Spacer()
                    Text("-\(format(row.expense))")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                    Text("+\(format(row.income))")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.mint)
                }
                .glassCard(cornerRadius: 12)
            }
        }
    }

    private var walletsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Wallets")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
            ForEach(availableCurrencies) { code in
                let tx = periodTransactions.filter { $0.currency == code }
                let income = tx.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount }
                let expenses = tx.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(code.rawValue)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.white)
                        Text("\(tx.count) tx")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(store.formatted(store.allWalletBalances[code] ?? 0, currency: code))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                        Text("-\(store.formatted(expenses, currency: code)) / +\(store.formatted(income, currency: code))")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.62))
                    }
                }
                .glassCard(cornerRadius: 16)
            }
        }
    }

    private func trendChart(limit: Int) -> some View {
        let rows = Array(trendRows.suffix(max(1, limit)))
        let maxAmount = max(1, rows.reduce(0) { current, row in
            max(current, max(row.expense, row.income))
        })

        return VStack(alignment: .leading, spacing: 10) {
            Text("Trends")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
            if rows.isEmpty {
                Text("No trend data")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.66))
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(rows) { row in
                            VStack(spacing: 6) {
                                HStack(alignment: .bottom, spacing: 3) {
                                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                                        .fill(Color.mint)
                                        .frame(width: 10, height: max(4, 90 * (row.income / maxAmount)))
                                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                                        .fill(Color.white)
                                        .frame(width: 10, height: max(4, 90 * (row.expense / maxAmount)))
                                }
                                Text(row.label)
                                    .font(.caption2)
                                    .foregroundStyle(.white.opacity(0.62))
                            }
                            .frame(width: 36)
                        }
                    }
                }
            }
        }
        .glassCard(cornerRadius: 18)
    }

    private func filterPill(title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(isActive ? .white : .white.opacity(0.74))
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isActive ? .white.opacity(0.18) : .white.opacity(0.08))
                )
        }
        .buttonStyle(.plain)
    }

    private func metricCard(title: String, value: String, detail: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.66))
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(accent)
            Text(detail)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.58))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(cornerRadius: 14)
    }

    private func resolvedCategory(for id: String) -> Category {
        expenseCategories.first(where: { $0.id == id }) ?? expenseCategories.last!
    }

    private func format(_ value: Double) -> String {
        if let code = currencyFilter {
            return store.formatted(value, currency: code)
        }
        return store.formatted(value, currency: store.settings.mainCurrency)
    }

    private func percent(_ value: Double) -> String {
        guard value.isFinite else { return "0%" }
        let sign = value > 0 ? "+" : ""
        return "\(sign)\(Int(value.rounded()))%"
    }

    private func sum(_ source: [TransactionItem], kind: TransactionKind) -> Double {
        source
            .filter { $0.kind == kind }
            .reduce(0) { partialResult, item in
                partialResult + amountForView(item)
            }
    }

    private func amountForView(_ item: TransactionItem) -> Double {
        if currencyFilter != nil {
            return item.amount
        }
        return store.convert(item.amount, from: item.currency, to: store.settings.mainCurrency)
    }

    private func previousRange(for range: AnalyticsDateRange) -> (start: Date, end: Date) {
        let current = range.bounds(relativeTo: Date())
        switch range {
        case .week:
            return (Calendar.current.date(byAdding: .day, value: -7, to: current.start) ?? .distantPast, Calendar.current.date(byAdding: .second, value: -1, to: current.start) ?? current.start)
        case .month:
            return (Calendar.current.date(byAdding: .month, value: -1, to: current.start) ?? .distantPast, Calendar.current.date(byAdding: .second, value: -1, to: current.start) ?? current.start)
        case .quarter:
            return (Calendar.current.date(byAdding: .day, value: -90, to: current.start) ?? .distantPast, Calendar.current.date(byAdding: .second, value: -1, to: current.start) ?? current.start)
        case .year:
            return (Calendar.current.date(byAdding: .year, value: -1, to: current.start) ?? .distantPast, Calendar.current.date(byAdding: .second, value: -1, to: current.start) ?? current.start)
        case .all:
            return (.distantPast, .distantPast)
        }
    }
}

private struct Totals {
    let expenses: Double
    let income: Double
    let previousExpenses: Double
    let previousIncome: Double
    let transactionCount: Int

    var net: Double { income - expenses }
    var previousNet: Double { previousIncome - previousExpenses }
    var dailyAverage: Double {
        guard transactionCount > 0 else { return 0 }
        return expenses / Double(max(1, transactionCount))
    }

    var expensesDelta: Double {
        guard previousExpenses > 0 else { return 0 }
        return ((expenses - previousExpenses) / previousExpenses) * 100
    }

    var incomeDelta: Double {
        guard previousIncome > 0 else { return 0 }
        return ((income - previousIncome) / previousIncome) * 100
    }

    var netDelta: Double {
        guard abs(previousNet) > 0 else { return 0 }
        return ((net - previousNet) / abs(previousNet)) * 100
    }
}

private struct CategoryRow: Identifiable {
    let category: String
    let amount: Double
    let count: Int
    var id: String { category }
}

private struct TrendRow: Identifiable {
    let label: String
    var date: Date
    var expense: Double
    var income: Double
    var id: String { "\(label)-\(date.timeIntervalSince1970)" }
}
