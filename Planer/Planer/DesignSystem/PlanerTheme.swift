import SwiftUI

extension Color {
    init(planerHex: String) {
        let cleaned = planerHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        let value = UInt64(cleaned, radix: 16) ?? 0x737D91
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }
}

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

extension TransactionCategory {
    var tint: Color {
        switch self {
        case .food: Color(red: 1.00, green: 0.48, blue: 0.22)
        case .transport: Color(red: 0.18, green: 0.58, blue: 1.00)
        case .home: Color(red: 0.55, green: 0.36, blue: 0.96)
        case .health: Color(red: 1.00, green: 0.31, blue: 0.45)
        case .shopping: Color(red: 0.93, green: 0.31, blue: 0.72)
        case .entertainment: Color(red: 0.98, green: 0.68, blue: 0.12)
        case .salary: PlanerTheme.positive
        case .transfer: PlanerTheme.accent
        case .other: Color(red: 0.45, green: 0.49, blue: 0.57)
        }
    }
}

extension TransactionCategoryPresentation {
    var tint: Color { Color(planerHex: colorHex) }
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
