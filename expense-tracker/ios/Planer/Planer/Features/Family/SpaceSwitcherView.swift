import SwiftUI

struct SpaceSwitcherView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyAccountStore.self) private var familyStore

    var body: some View {
        List {
            Section("Оберіть бюджет") {
                Button {
                    familyStore.selectPersonalSpace()
                    dismiss()
                } label: {
                    SpaceSwitcherRow(
                        title: "Особистий бюджет",
                        subtitle: "Тільки ваші гаманці та операції",
                        systemImage: "person.crop.circle.fill",
                        isSelected: familyStore.activeSpace.familyID == nil
                    )
                }
                .buttonStyle(.plain)

                ForEach(familyStore.families) { family in
                    Button {
                        familyStore.selectFamily(family)
                        dismiss()
                    } label: {
                        SpaceSwitcherRow(
                            title: family.name,
                            subtitle: "Сімейний бюджет · \(family.members.count) учасників",
                            systemImage: "person.3.fill",
                            isSelected: familyStore.activeSpace.familyID == family.id
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            Section {
                NavigationLink {
                    CreateFamilyView()
                } label: {
                    Label("Створити ще один сімейний акаунт", systemImage: "plus.circle.fill")
                }

                NavigationLink {
                    FamilyAccountsView()
                } label: {
                    Label("Керувати сімейними акаунтами", systemImage: "person.3.sequence.fill")
                }
            }
        }
        .navigationTitle("Простір бюджету")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Готово") { dismiss() }
            }
        }
    }
}

private struct SpaceSwitcherRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(isSelected ? PlanerTheme.accent : .secondary)
                .frame(width: 38, height: 38)
                .background(
                    (isSelected ? PlanerTheme.accent : Color.secondary).opacity(0.12),
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(PlanerTheme.positive)
            }
        }
        .contentShape(Rectangle())
    }
}

#Preview {
    NavigationStack { SpaceSwitcherView() }
        .environment(FamilyAccountStore.preview())
        .environment(FinanceStore.previewStore())
}
