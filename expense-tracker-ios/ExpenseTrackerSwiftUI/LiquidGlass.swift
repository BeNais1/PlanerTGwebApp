import SwiftUI

extension View {
    @ViewBuilder
    func liquidGlass<S: Shape>(
        tint: Color = .white.opacity(0.06),
        interactive: Bool = false,
        in shape: S
    ) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.tint(tint).interactive(interactive), in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
                .overlay(shape.stroke(.white.opacity(0.14), lineWidth: 1))
        }
    }

    func glassCard(cornerRadius: CGFloat = 28) -> some View {
        padding(18)
            .liquidGlass(in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

struct AppBackground: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color(hex: 0x07130F),
                Color(hex: 0x10201A),
                Color(hex: 0x171B2B)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}

extension Color {
    init(hex: UInt, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: opacity
        )
    }
}
