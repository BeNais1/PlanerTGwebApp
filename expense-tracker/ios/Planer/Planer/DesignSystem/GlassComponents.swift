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
        HStack(spacing: 14) {
            actionButton(title: "Витрата", icon: "arrow.up.right", tint: PlanerTheme.negative, action: onExpense)
            actionButton(title: "Дохід", icon: "arrow.down.left", tint: PlanerTheme.positive, action: onIncome)
            actionButton(title: "Переказ", icon: "arrow.left.arrow.right", tint: PlanerTheme.accent, action: onTransfer)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 8)
    }

    private func actionButton(title: String, icon: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                Text(title)
                    .font(.caption2.weight(.semibold))
            }
            .foregroundStyle(.primary)
            .frame(width: 68, height: 68)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .planerGlassCircle(tint: tint.opacity(0.28))
        .accessibilityLabel(title)
    }
}
