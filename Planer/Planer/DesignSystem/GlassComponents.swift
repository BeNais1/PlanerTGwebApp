import SwiftUI

private struct GlassCircleModifier: ViewModifier {
    let tint: Color

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.tint(tint).interactive(), in: .circle)
        } else {
            content
                .background(.ultraThinMaterial, in: Circle())
                .overlay {
                    Circle().stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                }
        }
    }
}

private struct GlassCapsuleModifier: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay {
                    Capsule().stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                }
        }
    }
}

private struct GlassRoundedButtonModifier: ViewModifier {
    let tint: Color
    private let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.tint(tint).interactive(), in: .rect(cornerRadius: 20))
                .clipShape(shape)
        } else {
            content
                .background(tint.opacity(0.12), in: shape)
                .background(.ultraThinMaterial, in: shape)
                .overlay {
                    shape.stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                }
                .clipShape(shape)
        }
    }
}

private struct GlassProminentButtonModifier: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.buttonStyle(.glassProminent)
        } else {
            content.buttonStyle(.borderedProminent)
        }
    }
}

extension View {
    func planerGlassCircle(tint: Color = .clear) -> some View {
        modifier(GlassCircleModifier(tint: tint))
    }

    func planerGlassCapsule() -> some View {
        modifier(GlassCapsuleModifier())
    }

    func planerGlassRoundedButton(tint: Color) -> some View {
        modifier(GlassRoundedButtonModifier(tint: tint))
    }

    func planerProminentButton() -> some View {
        modifier(GlassProminentButtonModifier())
    }
}

struct GlassActionCluster: View {
    let onExpense: () -> Void
    let onIncome: () -> Void
    let onTransfer: () -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 14) {
                actions
            }
        } else {
            actions
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            actionButton(title: "Витрата", icon: "arrow.up.right", tint: PlanerTheme.negative, action: onExpense)
            actionButton(title: "Дохід", icon: "arrow.down.left", tint: PlanerTheme.positive, action: onIncome)
            actionButton(title: "Переказ", icon: "arrow.left.arrow.right", tint: PlanerTheme.accent, action: onTransfer)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
    }

    private func actionButton(title: String, icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, minHeight: 58)
            .padding(.horizontal, 10)
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .planerGlassRoundedButton(tint: tint.opacity(0.20))
        .accessibilityLabel(title)
    }
}

struct AnimatedCurrencyAmountField: View {
    @Binding var text: String
    let currency: Currency
    var font: Font = .system(size: 38, weight: .bold, design: .rounded)
    var alignment: TextAlignment = .center

    var body: some View {
        HStack(spacing: 8) {
            TextField("0,00", text: $text)
                .font(font)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(alignment)
                .contentTransition(.numericText())

            Text(currency.symbol)
                .font(font)
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())
                .accessibilityHidden(true)
        }
        .animation(.snappy(duration: 0.24), value: text)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Сума у валюті \(currency.rawValue)")
    }
}
