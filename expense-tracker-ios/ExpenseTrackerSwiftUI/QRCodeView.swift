import SwiftUI
import CoreImage.CIFilterBuiltins
import UIKit

struct QRCodeView: View {
    let payload: String
    var size: CGFloat = 220
    var tint: Color = .black

    var body: some View {
        if let image = makeImage() {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(.white.opacity(0.1))
                .frame(width: size, height: size)
                .overlay(
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.yellow)
                )
        }
    }

    private func makeImage() -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        filter.correctionLevel = "M"

        guard let output = filter.outputImage else { return nil }
        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaled = output.transformed(by: transform)
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

struct ReceiptShareSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let receipt: ReceiptItem
    @State private var privacy: ReceiptPrivacy = .publicMode
    @State private var shareCode: String = ""

    private var shareURL: String {
        "expense-tracker://receipt/\(shareCode)"
    }

    var body: some View {
        ZStack {
            AppBackground(palette: .sunsetPeach)

            VStack(spacing: 16) {
                HStack {
                    Text("Поділитися чеком")
                        .font(Theme.Typography.title)
                        .foregroundStyle(.white)
                    Spacer()
                    GlassIconButton(systemImage: "xmark") { dismiss() }
                }
                .padding(.top, 14)
                .padding(.horizontal, 18)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        receiptCard
                        privacySelector
                        qrCard
                        Spacer(minLength: 80)
                    }
                    .padding(.horizontal, 18)
                }
            }
        }
        .onAppear {
            shareCode = receipt.shareCode ?? generateShareCode()
            if receipt.shareCode == nil {
                store.attachShareCode(shareCode, toReceipt: receipt.id)
            }
        }
    }

    private var receiptCard: some View {
        GlassCard(cornerRadius: Theme.Radius.xl, padding: 18, tint: Theme.Palette.cyan.opacity(0.15)) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "receipt.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.Palette.cyan)
                    Text(receipt.merchant)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                    Spacer()
                }
                Text(receipt.title)
                    .font(Theme.Typography.footnote)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                HStack {
                    Text(store.formatted(receipt.amount, currency: receipt.currency))
                        .font(Theme.Typography.title2.weight(.bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(AppLocale.mediumDateFormatter.string(from: receipt.date))
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }
            }
        }
    }

    private var privacySelector: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ПРИВАТНІСТЬ")
                .font(Theme.Typography.caption.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(Theme.Palette.tertiaryText)
            HStack(spacing: 8) {
                ForEach(ReceiptPrivacy.allCases) { mode in
                    GlassChip(title: mode.title, isSelected: privacy == mode) {
                        privacy = mode
                    }
                }
                Spacer()
            }
        }
    }

    private var qrCard: some View {
        VStack(spacing: 14) {
            QRCodeView(payload: shareURL, size: 220)
                .padding(20)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))

            VStack(spacing: 4) {
                Text("Код для обміну")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Palette.tertiaryText)
                Text(shareCode)
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                    .tracking(2)
            }

            ShareLink(item: shareURL) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Поділитися посиланням")
                }
                .font(Theme.Typography.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Gradient.primaryButton)
                .clipShape(Capsule())
            }
        }
        .padding(18)
        .liquidGlass(tint: .white.opacity(0.05), in: RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
    }

    private func generateShareCode() -> String {
        let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return String((0..<6).map { _ in chars.randomElement()! })
    }
}
