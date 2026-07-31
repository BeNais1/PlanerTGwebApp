import SwiftUI

private enum AnalyticsRange: String, CaseIterable, Identifiable {
    case week
    case month
    case year

    var id: String { rawValue }
    var title: String {
        switch self {
        case .week: "Тиждень"
        case .month: "Місяць"
        case .year: "Рік"
        }
    }
}

struct PlanerAnalyticsView: View {
    @Environment(FinanceStore.self) private var store
    @State private var range: AnalyticsRange = .month

    var body: some View {
        ZStack {
            AtmosphericBackground()

            ScrollView {
                VStack(spacing: 16) {
                    Picker("Період", selection: $range) {
                        ForEach(AnalyticsRange.allCases) { range in
                            Text(range.title).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)

                    summaryGrid
                    trendCard
                    categoriesCard
                }
                .padding(18)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Аналітика")
    }

    private var filteredTransactions: [FinanceTransaction] {
        let calendar = Calendar.current
        let start: Date
        switch range {
        case .week:
            start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: .now)) ?? .distantPast
        case .month:
            start = calendar.date(from: calendar.dateComponents([.year, .month], from: .now)) ?? .distantPast
        case .year:
            start = calendar.date(from: calendar.dateComponents([.year], from: .now)) ?? .distantPast
        }
        return store.transactions.filter { $0.date >= start }
    }

    private var expenseTotal: Double {
        filteredTransactions.filter { $0.kind == .expense }.reduce(0) {
            $0 + store.converted($1.amount, from: $1.currency, to: store.mainCurrency)
        }
    }

    private var incomeTotal: Double {
        filteredTransactions.filter { $0.kind == .income }.reduce(0) {
            $0 + store.converted($1.amount, from: $1.currency, to: store.mainCurrency)
        }
    }

    private var summaryGrid: some View {
        HStack(spacing: 12) {
            AnalyticsSummaryCard(title: "Доходи", value: store.mainCurrency.formatted(incomeTotal), tint: PlanerTheme.positive, icon: "arrow.down.left")
            AnalyticsSummaryCard(title: "Витрати", value: store.mainCurrency.formatted(expenseTotal), tint: PlanerTheme.negative, icon: "arrow.up.right")
        }
    }

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Динаміка витрат")
                        .font(.headline)
                    Text("Останні 7 днів")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chart.bar.xaxis")
                    .foregroundStyle(PlanerTheme.accent)
            }

            WeeklyBars(transactions: filteredTransactions, store: store)
                .frame(height: 150)
        }
        .padding(16)
        .contentCard()
    }

    private var categoriesCard: some View {
        let rows = store.categoryTotals(for: filteredTransactions)
        let maxValue = rows.first?.amount ?? 1

        return VStack(alignment: .leading, spacing: 0) {
            Text("Категорії")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

            if rows.isEmpty {
                ContentUnavailableView("Немає витрат", systemImage: "chart.pie")
                    .frame(minHeight: 170)
            } else {
                ForEach(rows) { row in
                    VStack(spacing: 8) {
                        HStack(spacing: 10) {
                            Image(systemName: row.category.systemImage)
                                .foregroundStyle(PlanerTheme.accent)
                                .frame(width: 30)
                            Text(row.category.title)
                                .font(.subheadline.weight(.medium))
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
                                        .fill(PlanerTheme.accent.gradient)
                                        .frame(width: proxy.size.width * max(0.04, row.amount / maxValue))
                                }
                        }
                        .frame(height: 5)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)

                    if row.id != rows.last?.id { Divider().padding(.leading, 56) }
                }
            }
        }
        .contentCard()
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
                .minimumScaleFactor(0.72)
                .lineLimit(1)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .contentCard()
    }
}

private struct WeeklyBars: View {
    let transactions: [FinanceTransaction]
    let store: FinanceStore

    var body: some View {
        let values = dailyValues
        let maximum = max(values.map(\.amount).max() ?? 0, 1)

        HStack(alignment: .bottom, spacing: 10) {
            ForEach(values) { value in
                VStack(spacing: 7) {
                    Capsule()
                        .fill(PlanerTheme.accent.gradient)
                        .frame(height: max(5, 118 * value.amount / maximum))
                    Text(value.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var dailyValues: [DailyValue] {
        let calendar = Calendar.current
        return (0..<7).reversed().map { offset in
            let date = calendar.date(byAdding: .day, value: -offset, to: .now) ?? .now
            let amount = transactions
                .filter { $0.kind == .expense && calendar.isDate($0.date, inSameDayAs: date) }
                .reduce(0) { $0 + store.converted($1.amount, from: $1.currency, to: store.mainCurrency) }
            let label = date.formatted(.dateTime.weekday(.narrow))
            return DailyValue(date: date, label: label, amount: amount)
        }
    }
}

private struct DailyValue: Identifiable {
    var id: Date { date }
    let date: Date
    let label: String
    let amount: Double
}

#Preview("Analytics") {
    NavigationStack { PlanerAnalyticsView() }
        .environment(FinanceStore(loadPersisted: false, persistsChanges: false))
        .preferredColorScheme(.dark)
}
