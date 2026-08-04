import ActivityKit
import SwiftUI
import WidgetKit

@main
struct PlanerLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        PlanerLiveActivityWidget()
    }
}

struct PlanerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DailyFinanceActivityAttributes.self) { context in
            PlanerLockScreenActivityView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.86))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "planer://transaction/expense"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ActivityAmount(
                        title: "Витрати",
                        value: context.state.expenses,
                        symbol: context.state.currencySymbol,
                        color: .red,
                        icon: "arrow.up.right"
                    )
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ActivityAmount(
                        title: "Дохід",
                        value: context.state.income,
                        symbol: context.state.currencySymbol,
                        color: .green,
                        icon: "arrow.down.left",
                        alignment: .trailing
                    )
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ActivityQuickActions()
                        .padding(.top, 4)
                }
            } compactLeading: {
                CompactAmount(value: context.state.expenses, symbol: context.state.currencySymbol, color: .red)
            } compactTrailing: {
                CompactAmount(value: context.state.income, symbol: context.state.currencySymbol, color: .green)
            } minimal: {
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
            }
            .widgetURL(URL(string: "planer://transaction/expense"))
            .keylineTint(.blue)
        }
    }
}

private struct PlanerLockScreenActivityView: View {
    let state: DailyFinanceActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PLANER")
                        .font(.caption.weight(.black))
                        .tracking(1.4)
                    Text("Підсумок за сьогодні")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
            }

            HStack(alignment: .top) {
                ActivityAmount(
                    title: "Витрачено",
                    value: state.expenses,
                    symbol: state.currencySymbol,
                    color: .red,
                    icon: "arrow.up.right"
                )
                Spacer()
                ActivityAmount(
                    title: "Отримано",
                    value: state.income,
                    symbol: state.currencySymbol,
                    color: .green,
                    icon: "arrow.down.left",
                    alignment: .trailing
                )
            }

            ActivityQuickActions()
        }
        .foregroundStyle(.white)
        .padding(16)
    }
}

private struct ActivityQuickActions: View {
    var body: some View {
        HStack(spacing: 10) {
            quickLink(
                title: "Витрата",
                icon: "arrow.up.right",
                color: .red,
                url: URL(string: "planer://transaction/expense")!
            )
            quickLink(
                title: "Дохід",
                icon: "arrow.down.left",
                color: .green,
                url: URL(string: "planer://transaction/income")!
            )
        }
    }

    private func quickLink(title: String, icon: String, color: Color, url: URL) -> some View {
        Link(destination: url) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 34)
                .background(color.opacity(0.22), in: Capsule())
                .overlay { Capsule().stroke(color.opacity(0.52), lineWidth: 0.5) }
        }
        .buttonStyle(.plain)
        .foregroundStyle(color)
    }
}

private struct ActivityAmount: View {
    let title: String
    let value: Double
    let symbol: String
    let color: Color
    let icon: String
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 3) {
            Label(title, systemImage: icon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(color)
            Text(value.formatted(.number.precision(.fractionLength(0...2))) + " " + symbol)
                .font(.headline.monospacedDigit())
                .contentTransition(.numericText())
        }
    }
}

private struct CompactAmount: View {
    let value: Double
    let symbol: String
    let color: Color

    var body: some View {
        Text(value.formatted(.number.notation(.compactName).precision(.fractionLength(0...1))) + symbol)
            .font(.caption2.bold().monospacedDigit())
            .foregroundStyle(color)
    }
}

