import SwiftUI

enum MeshPalette {
    case auroraNight
    case sunsetPeach
    case oceanDeep

    var colors: [Color] {
        switch self {
        case .auroraNight: return Theme.Gradient.auroraNight
        case .sunsetPeach: return Theme.Gradient.sunsetPeach
        case .oceanDeep: return Theme.Gradient.oceanDeep
        }
    }
}

struct AnimatedMeshBackground: View {
    var palette: MeshPalette = .auroraNight

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let drift = Float(sin(t * 0.18) * 0.06)
            let drift2 = Float(cos(t * 0.14) * 0.05)
            let drift3 = Float(sin(t * 0.22) * 0.04)

            if #available(iOS 18.0, *) {
                MeshGradient(
                    width: 3,
                    height: 3,
                    points: [
                        [0, 0],
                        [0.5 + drift, 0],
                        [1, 0],
                        [0, 0.5 + drift2],
                        [0.5 + drift3, 0.5 - drift2],
                        [1, 0.5 - drift],
                        [0, 1],
                        [0.5 - drift3, 1],
                        [1, 1]
                    ],
                    colors: palette.colors
                )
                .ignoresSafeArea()
                .overlay(
                    LinearGradient(
                        colors: [
                            Theme.Palette.backgroundDeep.opacity(0.45),
                            Color.clear,
                            Theme.Palette.backgroundDeep.opacity(0.6)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea()
                )
            } else {
                LinearGradient(
                    colors: palette.colors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            }
        }
    }
}

struct GlowOrb: View {
    var color: Color
    var size: CGFloat = 220
    var blur: CGFloat = 80

    var body: some View {
        Circle()
            .fill(color.opacity(0.55))
            .frame(width: size, height: size)
            .blur(radius: blur)
    }
}
