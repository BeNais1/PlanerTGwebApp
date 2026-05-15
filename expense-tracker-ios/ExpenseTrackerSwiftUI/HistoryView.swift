import SwiftUI

enum HistoryFilter: String, CaseIterable, Identifiable {
    case all
    case expense
    case income

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "Усе"
        case .expense: return "Витрати"
        case .income: return "Доходи"
        }
    }
}

struct HistoryView: View {
    @EnvironmentObject private var store: AppStore
    @State private var filter: HistoryFilter = .all
    @State private var searchText: String = ""

    private var filteredSections: [HistorySection] {
        let kind: TransactionKind? = {
            switch filter {
            case .all: return nil
            case .expense: return .expense
            case .income: return .income
            }
        }()

        let filtered = store.transactions.filter { item in
            if let kind, item.kind != kind { return false }
            if !searchText.isEmpty {
                let lower = searchText.lowercased()
                return item.note.lowercased().contains(lower)
                    || item.category.lowercased().contains(lower)
                    || String(item.amount).contains(lower)
            }
            return true
        }

        let grouped = Dictionary(grouping: filtered.sorted { $0.date > $1.date }) {
            AppLocale.relativeDay(for: $0.date)
        }

        return grouped
            .map { HistorySection(title: $0.key, items: $0.value) }
            .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Історія")
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.top, 8)

                searchBar
                    .padding(.horizontal, 18)

                filterChips
                    .padding(.horizontal, 18)

                if filteredSections.isEmpty {
                    EmptyStateCard(icon: "list.bullet.clipboard", title: "Записів немає", subtitle: "Спробуйте змінити фільтр або період")
                        .padding(.horizontal, 18)
                        .padding(.top, 24)
                } else {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(filteredSections) { section in
                            sectionView(section)
                        }
                    }
                    .padding(.horizontal, 18)
                }

                Color.clear.frame(height: 100)
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Palette.tertiaryText)
            TextField("Пошук за описом, категорією…", text: $searchText)
                .font(Theme.Typography.callout)
                .foregroundStyle(.white)
                .tint(Theme.Palette.indigo)
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .liquidGlass(tint: .white.opacity(0.05), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private var filterChips: some View {
        HStack(spacing: 8) {
            ForEach(HistoryFilter.allCases) { f in
                GlassChip(title: f.title, isSelected: filter == f) {
                    withAnimation(Theme.Motion.snappy) {
                        filter = f
                    }
                }
            }
            Spacer()
        }
    }

    private func sectionView(_ section: HistorySection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(section.title)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text(sectionTotal(section))
                    .font(Theme.Typography.footnote.weight(.semibold))
                    .foregroundStyle(Theme.Palette.secondaryText)
            }
            .padding(.horizontal, 4)

            ForEach(section.items) { item in
                TransactionRow(item: item)
                    .contextMenu {
                        Button(role: .destructive) {
                            HapticFeedback.warning()
                            store.deleteTransaction(item)
                        } label: {
                            Label("Видалити", systemImage: "trash")
                        }
                    }
            }
        }
    }

    private func sectionTotal(_ section: HistorySection) -> String {
        let total = section.items.reduce(0.0) { acc, item in
            let signed = item.kind == .income ? item.amount : -item.amount
            return acc + store.convert(signed, from: item.currency, to: store.settings.mainCurrency)
        }
        let sign = total >= 0 ? "+" : ""
        return "\(sign)\(store.formatted(total))"
    }
}
