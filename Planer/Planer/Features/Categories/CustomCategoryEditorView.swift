import SwiftUI
import UIKit

struct CustomCategoryEditorView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let kind: FinanceTransactionKind
    let onCreated: (UUID) -> Void

    @State private var title = ""
    @State private var selectedSymbol = "tag.fill"
    @State private var selectedColor = Color(planerHex: "247AFF")
    @State private var searchText = ""

    var body: some View {
        Form {
            Section("Категорія") {
                TextField("Назва", text: $title)
                    .textInputAutocapitalization(.sentences)

                HStack(spacing: 14) {
                    Image(systemName: selectedSymbol)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(selectedColor.gradient, in: RoundedRectangle(cornerRadius: 16))
                        .contentTransition(.symbolEffect(.replace))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title.isEmpty ? "Нова категорія" : title)
                            .font(.headline)
                        Text(kind == .income ? "Для доходів" : "Для витрат")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .animation(.snappy, value: selectedSymbol)

                ColorPicker("Колір", selection: $selectedColor, supportsOpacity: false)
            }

            Section("Іконка") {
                TextField("Пошук іконки", text: $searchText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 10)], spacing: 10) {
                    ForEach(filteredSymbols, id: \.self) { symbol in
                        Button {
                            withAnimation(.snappy) { selectedSymbol = symbol }
                        } label: {
                            Image(systemName: symbol)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(selectedSymbol == symbol ? .white : selectedColor)
                                .frame(width: 44, height: 44)
                                .background(
                                    selectedSymbol == symbol ? selectedColor : selectedColor.opacity(0.12),
                                    in: RoundedRectangle(cornerRadius: 13)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(symbol)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Створити категорію")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Створити") { save() }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var filteredSymbols: [String] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return CategoryIconCatalog.symbols }
        return CategoryIconCatalog.symbols.filter { $0.localizedCaseInsensitiveContains(query) }
    }

    private func save() {
        guard let category = store.addCustomCategory(
            title: title,
            systemImage: selectedSymbol,
            colorHex: selectedColor.planerHex,
            kind: kind
        ) else { return }
        onCreated(category.id)
        dismiss()
    }
}

private extension Color {
    var planerHex: String {
        let color = UIColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return "247AFF" }
        return String(format: "%02X%02X%02X", Int(red * 255), Int(green * 255), Int(blue * 255))
    }
}

private enum CategoryIconCatalog {
    static let symbols = [
        "tag.fill", "star.fill", "heart.fill", "bolt.fill", "flame.fill", "sparkles", "gift.fill",
        "fork.knife", "takeoutbag.and.cup.and.straw.fill", "cup.and.saucer.fill", "birthday.cake.fill",
        "car.fill", "bus.fill", "tram.fill", "airplane", "bicycle", "scooter", "fuelpump.fill",
        "house.fill", "building.2.fill", "bed.double.fill", "sofa.fill", "lamp.table.fill", "wrench.and.screwdriver.fill",
        "cross.case.fill", "pills.fill", "stethoscope", "heart.text.square.fill", "figure.run", "dumbbell.fill",
        "bag.fill", "cart.fill", "basket.fill", "tshirt.fill", "shoe.2.fill", "watch.analog", "laptopcomputer",
        "gamecontroller.fill", "music.note", "film.fill", "theatermasks.fill", "ticket.fill", "book.fill", "paintpalette.fill",
        "banknote.fill", "creditcard.fill", "wallet.bifold.fill", "building.columns.fill", "chart.line.uptrend.xyaxis",
        "briefcase.fill", "case.fill", "graduationcap.fill", "pencil.and.ruler.fill", "doc.text.fill", "printer.fill",
        "iphone", "display", "headphones", "camera.fill", "wifi", "antenna.radiowaves.left.and.right",
        "pawprint.fill", "dog.fill", "cat.fill", "fish.fill", "leaf.fill", "tree.fill", "drop.fill", "sun.max.fill",
        "person.fill", "person.2.fill", "figure.2.and.child.holdinghands", "babycarriage.fill", "hands.sparkles.fill",
        "globe.europe.africa.fill", "map.fill", "mappin.and.ellipse", "suitcase.fill", "tent.fill", "mountain.2.fill",
        "phone.fill", "envelope.fill", "message.fill", "bubble.left.and.bubble.right.fill", "bell.fill",
        "scissors", "hammer.fill", "paintbrush.fill", "key.fill", "lock.fill", "shield.fill", "lightbulb.fill",
        "clock.fill", "calendar", "timer", "checkmark.seal.fill", "exclamationmark.triangle.fill", "ellipsis",
        "shippingbox.fill", "archivebox.fill", "tray.fill", "square.grid.2x2.fill", "circle.grid.3x3.fill",
        "figure.walk", "figure.hiking", "figure.skiing.downhill", "figure.pool.swim", "sportscourt.fill",
        "soccerball", "basketball.fill", "football.fill", "tennis.racket", "trophy.fill", "medal.fill",
        "carrot.fill", "apple.logo", "refrigerator.fill", "washer.fill", "microwave.fill", "cooktop.fill",
        "bandage.fill", "syringe.fill", "facemask.fill", "allergens.fill", "brain.head.profile",
        "eyeglasses", "comb.fill", "handbag.fill", "backpack.fill", "umbrella.fill", "wand.and.stars",
        "newspaper.fill", "books.vertical.fill", "character.book.closed.fill", "text.book.closed.fill",
        "server.rack", "externaldrive.fill", "memorychip.fill", "keyboard.fill", "computermouse.fill",
        "arrow.left.arrow.right", "arrow.triangle.2.circlepath", "plus.circle.fill", "minus.circle.fill"
    ]
}
