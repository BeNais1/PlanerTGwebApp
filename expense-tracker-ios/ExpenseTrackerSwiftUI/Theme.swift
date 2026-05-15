import SwiftUI

enum Theme {
    enum Palette {
        static let backgroundDeep = Color(hex: 0x0A0A14)
        static let backgroundElevated = Color(hex: 0x12121F)
        static let surface = Color(hex: 0x1A1A28)
        static let surfaceElevated = Color(hex: 0x232337)

        static let indigo = Color(hex: 0x4F46E5)
        static let fuchsia = Color(hex: 0xD946EF)
        static let cyan = Color(hex: 0x06B6D4)
        static let mint = Color(hex: 0x10B981)
        static let amber = Color(hex: 0xFCD34D)
        static let rose = Color(hex: 0xFB7185)
        static let violet = Color(hex: 0x7C3AED)
        static let teal = Color(hex: 0x14B8A6)

        static let primaryText = Color.white
        static let secondaryText = Color.white.opacity(0.72)
        static let tertiaryText = Color.white.opacity(0.5)
        static let mutedText = Color.white.opacity(0.32)

        static let income = Color(hex: 0x34D399)
        static let expense = Color(hex: 0xFB7185)
        static let warning = Color(hex: 0xFBBF24)
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 14
        static let lg: CGFloat = 20
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    enum Radius {
        static let sm: CGFloat = 10
        static let md: CGFloat = 16
        static let lg: CGFloat = 22
        static let xl: CGFloat = 28
        static let xxl: CGFloat = 36
        static let pill: CGFloat = 999
    }

    enum Typography {
        static let display = Font.system(size: 52, weight: .bold, design: .rounded)
        static let largeTitle = Font.system(size: 34, weight: .bold, design: .rounded)
        static let title = Font.system(size: 26, weight: .bold, design: .rounded)
        static let title2 = Font.system(size: 20, weight: .semibold, design: .rounded)
        static let headline = Font.system(size: 17, weight: .semibold, design: .rounded)
        static let body = Font.system(size: 16, weight: .regular, design: .default)
        static let callout = Font.system(size: 15, weight: .medium, design: .default)
        static let footnote = Font.system(size: 13, weight: .medium, design: .default)
        static let caption = Font.system(size: 12, weight: .medium, design: .default)
    }

    enum Motion {
        static let snappy = Animation.spring(response: 0.34, dampingFraction: 0.78)
        static let smooth = Animation.spring(response: 0.48, dampingFraction: 0.82)
        static let bouncy = Animation.spring(response: 0.4, dampingFraction: 0.65)
        static let gentle = Animation.easeInOut(duration: 0.42)
    }

    enum Gradient {
        static let auroraNight: [Color] = [
            Palette.backgroundDeep,
            Palette.indigo.opacity(0.6),
            Palette.fuchsia.opacity(0.55),
            Palette.cyan.opacity(0.5),
            Palette.mint.opacity(0.4),
            Palette.violet.opacity(0.55),
            Palette.backgroundDeep,
            Palette.indigo.opacity(0.4),
            Palette.backgroundDeep
        ]

        static let sunsetPeach: [Color] = [
            Color(hex: 0x1A0B1F),
            Palette.violet.opacity(0.7),
            Palette.fuchsia.opacity(0.65),
            Color(hex: 0xF97316).opacity(0.55),
            Palette.amber.opacity(0.5),
            Palette.rose.opacity(0.6),
            Color(hex: 0x1A0B1F),
            Palette.violet.opacity(0.4),
            Color(hex: 0x1A0B1F)
        ]

        static let oceanDeep: [Color] = [
            Color(hex: 0x051628),
            Color(hex: 0x1E3A8A).opacity(0.75),
            Palette.cyan.opacity(0.6),
            Palette.teal.opacity(0.55),
            Palette.mint.opacity(0.45),
            Color(hex: 0x0EA5E9).opacity(0.6),
            Color(hex: 0x051628),
            Color(hex: 0x1E3A8A).opacity(0.5),
            Color(hex: 0x051628)
        ]

        static let incomeGlow = LinearGradient(
            colors: [Palette.mint, Palette.teal],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let expenseGlow = LinearGradient(
            colors: [Palette.rose, Color(hex: 0xEF4444)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let accentGlow = LinearGradient(
            colors: [Palette.indigo, Palette.fuchsia],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let primaryButton = LinearGradient(
            colors: [Palette.indigo, Palette.violet],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
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
