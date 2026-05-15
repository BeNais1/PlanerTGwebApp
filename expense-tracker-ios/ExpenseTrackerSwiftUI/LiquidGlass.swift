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

    func glassCard(cornerRadius: CGFloat = Theme.Radius.xl, padding: CGFloat = 18, tint: Color = .white.opacity(0.06)) -> some View {
        self.padding(padding)
            .liquidGlass(tint: tint, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

struct GlassCard<Content: View>: View {
    var cornerRadius: CGFloat = Theme.Radius.xl
    var padding: CGFloat = 18
    var tint: Color = .white.opacity(0.06)
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .liquidGlass(tint: tint, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

struct GlassButton: View {
    let title: LocalizedStringKey
    var icon: String? = nil
    var tint: Color = Theme.Palette.indigo
    var prominent: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedback.tap()
            action()
        }) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(Theme.Typography.headline)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(
                Group {
                    if prominent {
                        Theme.Gradient.primaryButton
                    } else {
                        Color.clear
                    }
                }
            )
        }
        .buttonStyle(.plain)
        .liquidGlass(
            tint: prominent ? tint.opacity(0.0) : tint.opacity(0.18),
            interactive: true,
            in: RoundedRectangle(cornerRadius: Theme.Radius.pill, style: .continuous)
        )
    }
}

struct GlassChip: View {
    let title: String
    var systemImage: String? = nil
    var isSelected: Bool = false
    var tint: Color = Theme.Palette.indigo
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedback.selection()
            action()
        }) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 12, weight: .bold))
                }
                Text(title)
                    .font(Theme.Typography.footnote)
            }
            .foregroundStyle(isSelected ? .white : Theme.Palette.secondaryText)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .liquidGlass(
            tint: isSelected ? tint.opacity(0.4) : .white.opacity(0.06),
            interactive: true,
            in: Capsule(style: .continuous)
        )
        .animation(Theme.Motion.snappy, value: isSelected)
    }
}

struct GlassIconButton: View {
    let systemImage: String
    var size: CGFloat = 44
    var tint: Color = .white.opacity(0.06)
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedback.tap()
            action()
        }) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: size, height: size)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: tint, interactive: true, in: Circle())
    }
}

struct GlassSectionHeader: View {
    let title: LocalizedStringKey
    var trailing: AnyView? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Palette.primaryText)
            Spacer()
            trailing
        }
        .padding(.horizontal, 4)
    }
}

struct AppBackground: View {
    var palette: MeshPalette = .auroraNight

    var body: some View {
        AnimatedMeshBackground(palette: palette)
    }
}
