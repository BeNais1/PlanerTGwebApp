import SwiftUI

enum AppTab: Hashable, CaseIterable {
    case home
    case history
    case analytics
    case finance
    case receipts

    var title: String {
        switch self {
        case .home: return "Головна"
        case .history: return "Історія"
        case .analytics: return "Аналітика"
        case .finance: return "Фінанси"
        case .receipts: return "Чеки"
        }
    }

    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .history: return "list.bullet.clipboard.fill"
        case .analytics: return "chart.pie.fill"
        case .finance: return "wallet.pass.fill"
        case .receipts: return "bookmark.fill"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthViewModel
    @State private var selectedTab = AppTab.home
    @State private var showingAddSheet = false

    var body: some View {
        Group {
            if auth.user == nil {
                SignInView()
            } else if !store.settings.onboardingCompleted {
                OnboardingFlow()
            } else {
                authenticatedContent
            }
        }
        .preferredColorScheme(.dark)
    }

    private var authenticatedContent: some View {
        ZStack(alignment: .bottom) {
            AppBackground(palette: paletteForTab(selectedTab))
                .animation(.easeInOut(duration: 1.0), value: selectedTab)

            currentScreen
                .padding(.bottom, 80)

            GlassTabBar(
                selection: $selectedTab,
                onAdd: { showingAddSheet = true }
            )
            .padding(.horizontal, 14)
            .padding(.bottom, 8)
        }
        .ignoresSafeArea(.keyboard)
        .sheet(isPresented: $showingAddSheet) {
            AddTransactionSheet()
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(.clear)
        }
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch selectedTab {
        case .home:
            DashboardView(showingAddSheet: $showingAddSheet)
        case .history:
            HistoryView()
        case .analytics:
            AnalyticsView()
        case .finance:
            FinancialHubView()
        case .receipts:
            ReceiptsView()
        }
    }

    private func paletteForTab(_ tab: AppTab) -> MeshPalette {
        switch tab {
        case .home, .history: return .auroraNight
        case .analytics: return .oceanDeep
        case .finance, .receipts: return .sunsetPeach
        }
    }
}

struct GlassTabBar: View {
    @Binding var selection: AppTab
    var onAdd: () -> Void

    private let leftTabs: [AppTab] = [.home, .history]
    private let rightTabs: [AppTab] = [.analytics, .finance, .receipts]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(leftTabs, id: \.self) { tab in
                tabButton(tab)
            }

            addButton

            ForEach(rightTabs, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .liquidGlass(tint: .white.opacity(0.05), in: Capsule(style: .continuous))
        .shadow(color: .black.opacity(0.35), radius: 24, x: 0, y: 10)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        let selected = tab == selection
        return Button {
            HapticFeedback.selection()
            withAnimation(Theme.Motion.snappy) {
                selection = tab
            }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: tab.icon)
                    .font(.system(size: 17, weight: .semibold))
                    .symbolEffect(.bounce, value: selected)
                if selected {
                    Capsule()
                        .fill(Theme.Palette.indigo)
                        .frame(width: 18, height: 3)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundStyle(selected ? .white : Theme.Palette.tertiaryText)
        }
        .buttonStyle(.plain)
    }

    private var addButton: some View {
        Button {
            HapticFeedback.tap()
            onAdd()
        } label: {
            ZStack {
                Circle()
                    .fill(Theme.Gradient.primaryButton)
                    .frame(width: 52, height: 52)
                    .shadow(color: Theme.Palette.indigo.opacity(0.5), radius: 12, x: 0, y: 4)
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
    }
}
