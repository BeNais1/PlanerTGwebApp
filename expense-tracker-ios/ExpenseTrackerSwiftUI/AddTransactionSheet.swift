import SwiftUI

struct AddTransactionSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var kind: TransactionKind = .expense
    @State private var amount: String = ""
    @State private var currency: CurrencyCode = .eur
    @State private var category: String = "food"
    @State private var note: String = ""
    @State private var date = Date()
    @State private var showingDatePicker = false

    private var parsedAmount: Double {
        Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    var body: some View {
        ZStack {
            AppBackground(palette: kind == .expense ? .sunsetPeach : .oceanDeep)

            VStack(spacing: 0) {
                handle
                kindSegment
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        amountDisplay
                        currencyPicker
                        if kind == .expense {
                            categoryGrid
                        }
                        noteAndDate
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 200)
                }

                NumericKeypad(text: $amount, onSubmit: save)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 8)
            }
        }
        .onAppear {
            currency = store.settings.mainCurrency
        }
        .onChange(of: note) { _, newValue in
            if let suggested = store.suggestedCategory(for: newValue) {
                if kind == .expense {
                    withAnimation(Theme.Motion.snappy) {
                        category = suggested
                    }
                }
            }
        }
    }

    private var handle: some View {
        Capsule()
            .fill(.white.opacity(0.25))
            .frame(width: 40, height: 5)
            .padding(.top, 10)
            .padding(.bottom, 14)
    }

    private var kindSegment: some View {
        HStack(spacing: 0) {
            ForEach(TransactionKind.allCases) { item in
                Button {
                    HapticFeedback.selection()
                    withAnimation(Theme.Motion.snappy) {
                        kind = item
                    }
                } label: {
                    Text(item.title)
                        .font(Theme.Typography.callout.weight(.semibold))
                        .foregroundStyle(kind == item ? .white : Theme.Palette.secondaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            Group {
                                if kind == item {
                                    Capsule()
                                        .fill(item.tint.opacity(0.4))
                                        .overlay(Capsule().stroke(item.tint.opacity(0.6), lineWidth: 1))
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .liquidGlass(tint: .white.opacity(0.04), in: Capsule(style: .continuous))
        .padding(.horizontal, 18)
        .padding(.bottom, 18)
    }

    private var amountDisplay: some View {
        VStack(spacing: 6) {
            Text(kind.title.uppercased())
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Palette.tertiaryText)
                .tracking(2)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(currency.symbol)
                    .font(.system(size: 36, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.Palette.secondaryText)
                Text(amount.isEmpty ? "0" : amount)
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText())
                    .animation(Theme.Motion.snappy, value: amount)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var currencyPicker: some View {
        HStack(spacing: 8) {
            ForEach(store.settings.enabledCurrencies) { code in
                GlassChip(
                    title: "\(code.symbol) \(code.rawValue)",
                    isSelected: code == currency,
                    tint: code.accent
                ) {
                    withAnimation(Theme.Motion.snappy) {
                        currency = code
                    }
                }
            }
            Spacer()
        }
    }

    private var categoryGrid: some View {
        let cats = store.allCategories
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
            ForEach(cats) { cat in
                CategoryTile(
                    category: cat,
                    selected: cat.id == category
                ) {
                    HapticFeedback.selection()
                    withAnimation(Theme.Motion.snappy) {
                        category = cat.id
                    }
                }
            }
        }
    }

    private var noteAndDate: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "text.alignleft")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Palette.tertiaryText)
                TextField("Опис (необов'язково)", text: $note)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(.white)
                    .tint(Theme.Palette.indigo)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))

            Button {
                HapticFeedback.tap()
                showingDatePicker.toggle()
            } label: {
                HStack {
                    Image(systemName: "calendar")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Palette.tertiaryText)
                    Text(date, format: .dateTime.day().month().hour().minute().locale(AppLocale.locale))
                        .font(Theme.Typography.callout)
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.Palette.tertiaryText)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
            .liquidGlass(tint: .white.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
            .sheet(isPresented: $showingDatePicker) {
                DatePickerSheet(date: $date)
                    .presentationDetents([.medium])
                    .presentationBackground(.clear)
            }
        }
    }

    private func save() {
        guard parsedAmount > 0 else {
            HapticFeedback.warning()
            return
        }
        HapticFeedback.success()
        store.addTransaction(
            kind: kind,
            amount: parsedAmount,
            currency: currency,
            category: kind == .income ? "income" : category,
            note: note,
            date: date
        )
        dismiss()
    }
}

struct CategoryTile: View {
    let category: Category
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(category.color.opacity(selected ? 0.85 : 0.22))
                        .frame(width: 42, height: 42)
                    Image(systemName: category.symbol)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(selected ? .white : category.color)
                }
                Text(category.title)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(selected ? .white : Theme.Palette.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .liquidGlass(
            tint: selected ? category.color.opacity(0.18) : .white.opacity(0.03),
            interactive: true,
            in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .stroke(selected ? category.color.opacity(0.6) : .clear, lineWidth: 1)
        )
    }
}

struct NumericKeypad: View {
    @Binding var text: String
    var onSubmit: () -> Void

    private let rows: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        [".", "0", "⌫"]
    ]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(rows.indices, id: \.self) { rowIndex in
                HStack(spacing: 8) {
                    ForEach(rows[rowIndex], id: \.self) { key in
                        key == "⌫" ? AnyView(backspaceButton) : AnyView(keyButton(key))
                    }
                }
            }

            Button(action: {
                onSubmit()
            }) {
                Text("Зберегти")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Theme.Gradient.primaryButton)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.pill, style: .continuous))
                    .shadow(color: Theme.Palette.indigo.opacity(0.5), radius: 14, x: 0, y: 6)
            }
            .buttonStyle(.plain)
        }
    }

    private func keyButton(_ key: String) -> some View {
        Button {
            HapticFeedback.tap()
            handleInput(key)
        } label: {
            Text(key)
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: .white.opacity(0.06), interactive: true, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private var backspaceButton: some View {
        Button {
            HapticFeedback.tap()
            if !text.isEmpty {
                text.removeLast()
            }
        } label: {
            Image(systemName: "delete.left.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.plain)
        .liquidGlass(tint: Theme.Palette.rose.opacity(0.16), interactive: true, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private func handleInput(_ key: String) {
        if key == "." {
            if !text.contains(".") {
                text = text.isEmpty ? "0." : text + "."
            }
            return
        }
        if text.contains(".") {
            let parts = text.split(separator: ".", maxSplits: 1)
            if parts.count == 2 && parts[1].count >= 2 { return }
        }
        if text == "0" {
            text = key
        } else {
            text += key
        }
    }
}

struct DatePickerSheet: View {
    @Binding var date: Date
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            AppBackground(palette: .auroraNight)
            VStack(spacing: 16) {
                Text("Дата та час")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(.white)
                    .padding(.top, 18)

                DatePicker("", selection: $date, displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.wheel)
                    .environment(\.locale, AppLocale.locale)
                    .labelsHidden()
                    .colorScheme(.dark)
                    .padding(.horizontal, 18)

                Button {
                    dismiss()
                } label: {
                    Text("Готово")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.Gradient.primaryButton)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
            }
        }
    }
}
