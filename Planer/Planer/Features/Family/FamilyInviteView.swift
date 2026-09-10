import CoreImage.CIFilterBuiltins
import SwiftUI

struct FamilyInviteView: View {
    @Environment(\.dismiss) private var dismiss
    let invite: FamilyInvite

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(PlanerTheme.accent)
                    Text("Запрошення до сім’ї")
                        .font(.title2.bold())
                    Text(invite.familyName)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                QRCodeImage(value: invite.url.absoluteString)
                    .frame(width: 250, height: 250)
                    .padding(18)
                    .background(.white, in: RoundedRectangle(cornerRadius: 28, style: .continuous))

                VStack(spacing: 6) {
                    Text(invite.code)
                        .font(.system(.title3, design: .monospaced, weight: .bold))
                        .textSelection(.enabled)
                    Text("Діє до \(invite.expiresAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                ShareLink(
                    item: invite.url,
                    subject: Text("Запрошення до \(invite.familyName)"),
                    message: Text("Приєднуйся до сімейного бюджету в Planer")
                ) {
                    Label("Поділитися запрошенням", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Text("Людина може відкрити посилання на iPhone або відсканувати цей QR-код у Planer.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
        }
        .navigationTitle("Запросити")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
    }
}

private struct QRCodeImage: View {
    let value: String

    var body: some View {
        if let image = Self.makeImage(value: value) {
            Image(uiImage: image)
                .resizable()
                .interpolation(.none)
                .antialiased(false)
                .accessibilityLabel("QR-код запрошення до сім’ї")
        } else {
            ContentUnavailableView(
                "QR-код недоступний",
                systemImage: "qrcode",
                description: Text("Скопіюйте код запрошення вручну.")
            )
        }
    }

    private static func makeImage(value: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let outputImage = filter.outputImage else { return nil }
        let transformed = outputImage.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cgImage = CIContext().createCGImage(transformed, from: transformed.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }
}

#Preview("Family invite") {
    NavigationStack {
        FamilyInviteView(
            invite: FamilyInvite(
                code: "PLANER2026",
                familyID: "preview-family",
                familyName: "Родина Богатирів",
                createdBy: "preview-user",
                expiresAt: Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now
            )
        )
    }
}
