import SwiftUI
import Charts

enum AnalyticsTab: String, CaseIterable, Identifiable {
    case overview
    case categories
    case trends
    case wallets

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Огляд"
        case .categories: return "Категорії"
        case .trends: return "Тренди"
        case .wallets: return "Гаманці"
        }
    }
}

struct AnalyticsView: View {
    @EnvironmentObject private var store: AppStore

    @State private var selectedRange: AnalyticsDateRange = .month
    @State private var selectedTab: AnalyticsTab = .overview
    @State private var selectedType: AnalyticsTypeFilter = .expense

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                header
                rangePicker
                tabPicker

                switch selectedTab {
                case .overview: OverviewTab(range: selectedRange)
                case .categories: CategoriesTab(range: selectedRange, type: selectedType)
                case .trends: TrendsTab(range: selectedRange)
                case .wallets: WalletsTab(range: selectedRange)
                }

                Color.clear.frame(height: 100)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Аналітика")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(.white)
            Text("Витрати, доходи й тренди")
                .font(Theme.Typography.footnote)
                .foregroundStyle(Theme.Palette.tertiaryText)
        }
    }

    private var rangePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AnalyticsDateRange.allCases) { range in
                    GlassChip(title: range.title, isSelected: selectedRange == range) {
                        withAnimation(Theme.Motion.snappy) {
                            selectedRange = range
                        }
                    }
                }
            }
        }
    }

    private var tabPicker: some View {
        HStack(spacing: 6) {
            ForEach(AnalyticsTab.allCases) { tab in
                Button {
                    HapticFeedback.selection()
                    withAnimation(Theme.Motion.snappy) {
                        selectedTab = tab
                    }
                } label: {
                    Text(tab.title)
                        .font(Theme.Typography.footnote.weight(.semibold))
                        .foregroundStyle(selectedTab == tab ? .white : Theme.Palette.tertiaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            Group {
                                if selectedTab == tab {
                                    Capsule().fill(Theme.Palette.indigo.opacity(0.4))
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .liquidGlass(tint: .white.opacity(0.04), in: Capsule())
    }
}

struct OverviewTab: View {
    @EnvironmentObject private var store: AppStore
    let range: AnalyticsDateRange

    private var transactions: [TransactionItem] {
        store.transactionsInRange(range, currencyFilter: nil, typeFilter: .all, categoryFilter: nil)
    }

    private var expenses: Double {
        transactions.filter { $0.kind == .expense }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    private var income: Double {
        transactions.filter { $0.kind == .income }
            .reduce(0) { $0 + store.convert($1.amount, from: $1.currency, to: store.settings.mainCurrency) }
    }

    private var dailyData: [DailyTotal] {
        let bounds = range.bounds(relativeTo: Date())
        let calendar = Calendar.current
        let days = max(1, calendar.dateComponents([.day], from: bounds.start, to: bounds.end).day ?? 1)

        var map: [String: DailyTotal] = [:]
        for item in transactions {
            let key = AppLocale.dayMonthFormatter.string(from: item.date)
            var row = map[key] ?? DailyTotal(date: item.date, label: key, expense: 0, income: 0)
            let value = store.convert(item.amount, from: item.currency, to: store.settings.mainCurrency)
            if item.kind == .expense { row.expense += value } else { row.income += value }
            row.date = min(row.date, item.date)
            map[key] = row
        }
        let result = map.values.sorted { $0.date < $1.date }
        return Array(result.suffix(min(days, 14)))
    }

    var body: some View {
        VStack(spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                metric(title: "Витрати", value: expenses, tint: Theme.Palette.expense, icon: "arrow.up.right")
                metric(title: "Доходи", value: income, tint: Theme.Palette.income, icon: "arrow.down.left")
                metric(title: "Чистий", value: income - expenses, tint: (income - expenses) >= 0 ? Theme.Palette.mint : Theme.Palette.rose, icon: "scalemass")
                metric(title: "Транзакцій", value: Double(transactions.count), tint: Theme.Palette.indigo, icon: "number", isCount: true)
            }

            chartCard
        }
    }

    private func metric(title: String, value: Double, tint: Color, icon: String, isCount: Bool = false) -> some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: tint.opacity(0.12)) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(tint)
                        .frame(width: 26, height: 26)
                        .background(tint.opacity(0.18), in: Circle())
                    Spacer()
                }
                Text(title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Text(isCount ? "\(Int(value))" : store.formatted(value))
                    .font(Theme.Typography.title2.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }

    private var chartCard: some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Динаміка")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)

                if dailyData.isEmpty {
                    Text("Немає даних")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                        .frame(maxWidth: .infinity, minHeight: 160)
                } else {
                    Chart {
                        ForEach(dailyData) { row in
                            BarMark(
                                x: .value("Дата", row.date, unit: .day),
                                y: .value("Витрати", row.expense)
                            )
                            .foregroundStyle(Theme.Palette.expense.gradient)
                            .cornerRadius(4)

                            BarMark(
                                x: .value("Дата", row.date, unit: .day),
                                y: .value("Доходи", row.income)
                            )
                            .foregroundStyle(Theme.Palette.mint.gradient)
                            .cornerRadius(4)
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .day, count: max(1, dailyData.count / 6))) { _ in
                            AxisGridLine().foregroundStyle(.white.opacity(0.08))
                            AxisValueLabel(format: .dateTime.day().month(.abbreviated).locale(AppLocale.locale))
                                .foregroundStyle(Theme.Palette.tertiaryText)
                        }
                    }
                    .chartYAxis {
                        AxisMarks { _ in
                            AxisGridLine().foregroundStyle(.white.opacity(0.06))
                            AxisValueLabel().foregroundStyle(Theme.Palette.tertiaryText)
                        }
                    }
                    .frame(height: 200)
                }
            }
        }
    }
}

struct CategoriesTab: View {
    @EnvironmentObject private var store: AppStore
    let range: AnalyticsDateRange
    let type: AnalyticsTypeFilter

    private var rows: [CategoryRow] {
        let txs = store.transactionsInRange(range, currencyFilter: nil, typeFilter: .all, categoryFilter: nil)
            .filter { $0.kind == .expense }
        var dict: [String: CategoryRow] = [:]
        for item in txs {
            let v = store.convert(item.amount, from: item.currency, to: store.settings.mainCurrency)
            let prev = dict[item.category] ?? CategoryRow(category: item.category, amount: 0, count: 0)
            dict[item.category] = CategoryRow(category: item.category, amount: prev.amount + v, count: prev.count + 1)
        }
        return dict.values.sorted { $0.amount > $1.amount }
    }

    private var total: Double {
        max(0.01, rows.reduce(0) { $0 + $1.amount })
    }

    var body: some View {
        VStack(spacing: 14) {
            donutChart
            categoryList
        }
    }

    private var donutChart: some View {
        GlassCard(cornerRadius: Theme.Radius.xl, padding: 18) {
            VStack(spacing: 10) {
                Text("Розподіл витрат")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)

                if rows.isEmpty {
                    Text("Немає даних за період")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                        .frame(height: 200)
                } else {
                    Chart {
                        ForEach(rows) { row in
                            let cat = categoryById(row.category, customCategories: store.settings.customCategories)
                            SectorMark(
                                angle: .value("Сума", row.amount),
                                innerRadius: .ratio(0.62),
                                angularInset: 2
                            )
                            .foregroundStyle(cat.color)
                            .cornerRadius(6)
                        }
                    }
                    .chartLegend(.hidden)
                    .frame(height: 220)
                    .overlay {
                        VStack(spacing: 2) {
                            Text("Усього")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Palette.tertiaryText)
                            Text(store.formatted(total))
                                .font(Theme.Typography.title2.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
        }
    }

    private var categoryList: some View {
        VStack(spacing: 8) {
            ForEach(rows) { row in
                let cat = categoryById(row.category, customCategories: store.settings.customCategories)
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(cat.color.opacity(0.22))
                            .frame(width: 40, height: 40)
                        Image(systemName: cat.symbol)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(cat.color)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(cat.title)
                                .font(Theme.Typography.callout)
                                .foregroundStyle(.white)
                            Spacer()
                            Text(store.formatted(row.amount))
                                .font(Theme.Typography.footnote.weight(.bold))
                                .foregroundStyle(.white)
                        }
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.1))
                                Capsule()
                                    .fill(cat.color.gradient)
                                    .frame(width: max(4, proxy.size.width * (row.amount / total)))
                            }
                        }
                        .frame(height: 6)
                        HStack {
                            Text("\(row.count) транз.")
                            Spacer()
                            Text("\(Int((row.amount / total) * 100))%")
                        }
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    }
                }
                .padding(14)
                .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
            }
        }
    }
}

struct TrendsTab: View {
    @EnvironmentObject private var store: AppStore
    let range: AnalyticsDateRange

    private var rows: [DailyTotal] {
        let txs = store.transactionsInRange(range, currencyFilter: nil, typeFilter: .all, categoryFilter: nil)
        var map: [String: DailyTotal] = [:]
        for item in txs {
            let key = AppLocale.dayMonthFormatter.string(from: item.date)
            var row = map[key] ?? DailyTotal(date: item.date, label: key, expense: 0, income: 0)
            let value = store.convert(item.amount, from: item.currency, to: store.settings.mainCurrency)
            if item.kind == .expense { row.expense += value } else { row.income += value }
            row.date = min(row.date, item.date)
            map[key] = row
        }
        return map.values.sorted { $0.date < $1.date }
    }

    var body: some View {
        VStack(spacing: 14) {
            lineChart
            summary
        }
    }

    private var lineChart: some View {
        GlassCard(cornerRadius: Theme.Radius.xl, padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Тренди")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)

                if rows.isEmpty {
                    Text("Немає даних")
                        .font(Theme.Typography.footnote)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                        .frame(height: 200)
                } else {
                    Chart {
                        ForEach(rows) { row in
                            LineMark(
                                x: .value("Дата", row.date),
                                y: .value("Витрати", row.expense),
                                series: .value("Тип", "Витрати")
                            )
                            .foregroundStyle(Theme.Palette.expense)
                            .interpolationMethod(.catmullRom)
                            .lineStyle(StrokeStyle(lineWidth: 3))

                            AreaMark(
                                x: .value("Дата", row.date),
                                y: .value("Витрати", row.expense),
                                series: .value("Тип", "Витрати")
                            )
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Theme.Palette.expense.opacity(0.4), Theme.Palette.expense.opacity(0)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .interpolationMethod(.catmullRom)

                            LineMark(
                                x: .value("Дата", row.date),
                                y: .value("Доходи", row.income),
                                series: .value("Тип", "Доходи")
                            )
                            .foregroundStyle(Theme.Palette.mint)
                            .interpolationMethod(.catmullRom)
                            .lineStyle(StrokeStyle(lineWidth: 3))
                        }
                    }
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisGridLine().foregroundStyle(.white.opacity(0.06))
                            AxisValueLabel(format: .dateTime.day().month(.abbreviated).locale(AppLocale.locale))
                                .foregroundStyle(Theme.Palette.tertiaryText)
                        }
                    }
                    .chartYAxis {
                        AxisMarks { _ in
                            AxisGridLine().foregroundStyle(.white.opacity(0.06))
                            AxisValueLabel().foregroundStyle(Theme.Palette.tertiaryText)
                        }
                    }
                    .frame(height: 240)
                }
            }
        }
    }

    private var summary: some View {
        let totalExpense = rows.reduce(0) { $0 + $1.expense }
        let totalIncome = rows.reduce(0) { $0 + $1.income }
        let avg = rows.isEmpty ? 0 : totalExpense / Double(rows.count)

        return HStack(spacing: 10) {
            metricPill(title: "Сер. за день", value: store.formatted(avg), tint: Theme.Palette.indigo)
            metricPill(title: "Чистий", value: store.formatted(totalIncome - totalExpense), tint: (totalIncome - totalExpense) >= 0 ? Theme.Palette.mint : Theme.Palette.rose)
        }
    }

    private func metricPill(title: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Palette.tertiaryText)
            Text(value)
                .font(Theme.Typography.headline.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .liquidGlass(tint: tint.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }
}

struct WalletsTab: View {
    @EnvironmentObject private var store: AppStore
    let range: AnalyticsDateRange

    private var balances: [WalletData] {
        store.settings.enabledCurrencies.map { code in
            let txs = store.transactionsInRange(range, currencyFilter: code, typeFilter: .all, categoryFilter: nil)
            let income = txs.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount }
            let expense = txs.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
            return WalletData(
                currency: code,
                balance: store.balance(for: code),
                income: income,
                expense: expense
            )
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            chart
            ForEach(balances) { data in
                walletRow(data)
            }
        }
    }

    private var chart: some View {
        GlassCard(cornerRadius: Theme.Radius.xl, padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Активність гаманців")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)

                Chart {
                    ForEach(balances) { data in
                        BarMark(
                            x: .value("Дохід", data.income),
                            y: .value("Валюта", data.currency.rawValue)
                        )
                        .foregroundStyle(Theme.Palette.mint.gradient)
                        .cornerRadius(6)

                        BarMark(
                            x: .value("Витрати", -data.expense),
                            y: .value("Валюта", data.currency.rawValue)
                        )
                        .foregroundStyle(Theme.Palette.expense.gradient)
                        .cornerRadius(6)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisGridLine().foregroundStyle(.white.opacity(0.06))
                        AxisValueLabel().foregroundStyle(Theme.Palette.tertiaryText)
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel().foregroundStyle(.white)
                    }
                }
                .frame(height: 160)
            }
        }
    }

    private func walletRow(_ data: WalletData) -> some View {
        GlassCard(cornerRadius: Theme.Radius.lg, padding: 14, tint: data.currency.accent.opacity(0.1)) {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(data.currency.accent.opacity(0.3)).frame(width: 44, height: 44)
                    Text(data.currency.symbol)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(store.walletName(for: data.currency))
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        Text("+\(store.formatted(data.income, currency: data.currency))")
                            .foregroundStyle(Theme.Palette.mint)
                        Text("·")
                            .foregroundStyle(Theme.Palette.tertiaryText)
                        Text("−\(store.formatted(data.expense, currency: data.currency))")
                            .foregroundStyle(Theme.Palette.rose)
                    }
                    .font(Theme.Typography.caption)
                }
                Spacer()
                Text(store.formatted(data.balance, currency: data.currency))
                    .font(Theme.Typography.headline.weight(.bold))
                    .foregroundStyle(.white)
            }
        }
    }
}

struct DailyTotal: Identifiable, Hashable {
    var date: Date
    let label: String
    var expense: Double
    var income: Double
    var id: String { "\(label)-\(date.timeIntervalSince1970)" }
}

struct CategoryRow: Identifiable {
    let category: String
    let amount: Double
    let count: Int
    var id: String { category }
}

struct WalletData: Identifiable {
    let currency: CurrencyCode
    let balance: Double
    let income: Double
    let expense: Double
    var id: String { currency.rawValue }
}
