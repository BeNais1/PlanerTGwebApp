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
        let colors = [Color(red: 0.16, green: 0.17, blue: 0.19), Color(red: 0.23, green: 0.24, blue: 0.27)]
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
        Color(.systemGroupedBackground)
        .ignoresSafeArea()
    }
}

struct ContentCardModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .background(
                colorScheme == .dark
                    ? Color(.secondarySystemGroupedBackground)
                    : Color(.secondarySystemGroupedBackground),
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
