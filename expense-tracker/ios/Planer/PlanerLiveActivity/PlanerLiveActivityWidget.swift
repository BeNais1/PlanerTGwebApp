import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

@main
struct PlanerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DailyFinanceActivityAttributes.self) { context in
            LockScreenActivityView(state: context.state)
                .activityBackgroundTint(.black)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    AmountView(
                        title: "Витрати",
                        prefix: "−",
                        value: context.state.expenses,
                        symbol: context.state.currencySymbol,
                        color: .red,
                        alignment: .leading
                    )
                }

                DynamicIslandExpandedRegion(.trailing) {
                    AmountView(
                        title: "Дохід",
                        prefix: "+",
                        value: context.state.income,
                        symbol: context.state.currencySymbol,
                        color: .green,
                        alignment: .trailing
                    )
                }

                DynamicIslandExpandedRegion(.bottom) {
                    Text("Підсумок за сьогодні")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.white.opacity(0.72))
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                }
            } compactLeading: {
                CompactAmount(
                    prefix: "−",
                    value: context.state.expenses,
                    symbol: context.state.currencySymbol,
                    color: .red
                )
            } compactTrailing: {
                CompactAmount(
                    prefix: "+",
                    value: context.state.income,
                    symbol: context.state.currencySymbol,
                    color: .green
                )
            } minimal: {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.blue)
            }
            .keylineTint(.blue)
        }
    }
}

private struct LockScreenActivityView: View {
    let state: DailyFinanceActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.blue)

                VStack(alignment: .leading, spacing: 1) {
                    Text("PLANER")
                        .font(.caption.weight(.black))
                    Text("Підсумок за сьогодні")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.72))
                }

                Spacer(minLength: 0)
            }

            HStack(alignment: .top, spacing: 16) {
                AmountView(
                    title: "Витрачено",
                    prefix: "−",
                    value: state.expenses,
                    symbol: state.currencySymbol,
                    color: .red,
                    alignment: .leading
                )

                Spacer(minLength: 0)

                AmountView(
                    title: "Отримано",
                    prefix: "+",
                    value: state.income,
                    symbol: state.currencySymbol,
                    color: .green,
                    alignment: .trailing
                )
            }
        }
        .foregroundColor(.white)
        .padding(16)
    }
}

private struct AmountView: View {
    let title: String
    let prefix: String
    let value: Double
    let symbol: String
    let color: Color
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundColor(color)

            Text("\(prefix)\(formatted(value)) \(symbol)")
                .font(.headline.monospacedDigit())
                .foregroundColor(.white)
        }
    }
}

private struct CompactAmount: View {
    let prefix: String
    let value: Double
    let symbol: String
    let color: Color

    var body: some View {
        Text("\(prefix)\(formatted(value))\(symbol)")
            .font(.caption2.weight(.bold).monospacedDigit())
            .foregroundColor(color)
    }
}

private func formatted(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...1)))
}
