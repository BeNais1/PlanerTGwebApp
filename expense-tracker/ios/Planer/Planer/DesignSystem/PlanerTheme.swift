import SwiftUI

enum PlanerTheme {
    static let accent = Color(red: 0.14, green: 0.48, blue: 1.0)
    static let positive = Color(red: 0.20, green: 0.78, blue: 0.50)
    static let negative = Color(red: 1.0, green: 0.38, blue: 0.42)
    static let warning = Color(red: 1.0, green: 0.67, blue: 0.18)

    static func walletGradient(_ palette: WalletPalette) -> LinearGradient {
        let colors: [Color]
        switch palette {
        case .violet:
            colors = [Color(red: 0.26, green: 0.08, blue: 0.58), Color(red: 0.58, green: 0.20, blue: 0.96)]
        case .blue:
            colors = [Color(red: 0.03, green: 0.26, blue: 0.60), Color(red: 0.10, green: 0.60, blue: 0.94)]
        case .graphite:
            colors = [Color(red: 0.10, green: 0.11, blue: 0.15), Color(red: 0.30, green: 0.32, blue: 0.40)]
        case .emerald:
            colors = [Color(red: 0.02, green: 0.34, blue: 0.26), Color(red: 0.10, green: 0.70, blue: 0.48)]
        }
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

struct AtmosphericBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            (colorScheme == .dark ? Color.black : Color(.systemGroupedBackground))

            Circle()
                .fill(PlanerTheme.accent.opacity(colorScheme == .dark ? 0.28 : 0.18))
                .frame(width: 320, height: 320)
                .blur(radius: 90)
                .offset(x: 170, y: -320)

            Circle()
                .fill(Color.purple.opacity(colorScheme == .dark ? 0.18 : 0.10))
                .frame(width: 280, height: 280)
                .blur(radius: 100)
                .offset(x: -170, y: 310)
        }
        .ignoresSafeArea()
    }
}

struct ContentCardModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .background(
                colorScheme == .dark
                    ? Color.white.opacity(0.075)
                    : Color.white.opacity(0.82),
                in: RoundedRectangle(cornerRadius: 24, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(colorScheme == .dark ? 0.08 : 0.6), lineWidth: 0.5)
            }
    }
}

extension View {
    func contentCard() -> some View {
        modifier(ContentCardModifier())
    }
}
