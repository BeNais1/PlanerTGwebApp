import SwiftUI

struct FamilyDetailView: View {
    @Environment(FamilyAccountStore.self) private var familyStore
    let familyID: String
    @State private var invite: FamilyInvite?
    @State private var isCreatingInvite = false
    @State private var errorMessage: String?
    @State private var memberToRemove: FamilyMember?
    @State private var memberToConfigure: FamilyMember?
    @State private var showLeaveConfirmation = false

    private var family: FamilySummary? {
        familyStore.families.first { $0.id == familyID }
    }

    var body: some View {
        Group {
            if let family {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Label(family.name, systemImage: "person.3.fill")
                                .font(.title2.bold())
                            Text("Спільний бюджет для \(family.members.count) учасників")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)

                        if familyStore.activeSpace.familyID == family.id {
                            Label("Цей простір активний", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(PlanerTheme.positive)
                        } else {
                            Button {
                                familyStore.selectFamily(family)
                            } label: {
                                Label("Перейти до сімейного бюджету", systemImage: "arrow.right.circle.fill")
                            }
                        }
                    }

                    Section("Учасники") {
                        ForEach(family.members) { member in
                            Group {
                                if family.ownerID == familyStore.currentUserID,
                                   member.userID != family.ownerID {
                                    Button {
                                        memberToConfigure = member
                                    } label: {
                                        FamilyMemberRow(member: member)
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    FamilyMemberRow(member: member)
                                }
                            }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    if family.ownerID == familyStore.currentUserID,
                                       member.userID != family.ownerID {
                                        Button("Видалити", role: .destructive) {
                                            memberToRemove = member
                                        }
                                    }
                                }
                        }
                    }

                    Section("Запрошення") {
                        Button {
                            Task { await createInvite(for: family) }
                        } label: {
                            if isCreatingInvite {
                                HStack {
                                    ProgressView()
                                    Text("Створюємо запрошення…")
                                }
                            } else {
                                Label("Посилання та QR-код", systemImage: "qrcode")
                            }
                        }
                        .disabled(isCreatingInvite || !familyStore.canInvite(to: family))
                        Text("Нове запрошення діє сім днів. Його можна надіслати як посилання або показати у вигляді QR-коду.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !familyStore.canInvite(to: family) {
                            Label("Власник сім’ї не надав вам право запрошувати учасників.", systemImage: "lock.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if family.ownerID != familyStore.currentUserID {
                        Section {
                            Button("Вийти із сім’ї", role: .destructive) {
                                showLeaveConfirmation = true
                            }
                        }
                    }

                    if let errorMessage {
                        Section {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(PlanerTheme.negative)
                        }
                    }
                }
                .navigationTitle(family.name)
                .navigationBarTitleDisplayMode(.inline)
                .sheet(item: $invite) { invite in
                    NavigationStack { FamilyInviteView(invite: invite) }
                }
                .sheet(item: $memberToConfigure) { member in
                    NavigationStack {
                        FamilyMemberPermissionsView(
                            familyID: family.id,
                            member: member
                        )
                    }
                }
                .confirmationDialog(
                    "Видалити учасника?",
                    isPresented: Binding(
                        get: { memberToRemove != nil },
                        set: { if !$0 { memberToRemove = nil } }
                    ),
                    titleVisibility: .visible
                ) {
                    if let memberToRemove {
                        Button("Видалити \(memberToRemove.displayName)", role: .destructive) {
                            Task { await remove(memberToRemove, from: family) }
                        }
                    }
                    Button("Скасувати", role: .cancel) { memberToRemove = nil }
                } message: {
                    Text("Учасник втратить доступ до спільних гаманців та операцій.")
                }
                .confirmationDialog(
                    "Вийти із сім’ї \(family.name)?",
                    isPresented: $showLeaveConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Вийти", role: .destructive) {
                        Task { await leave(family) }
                    }
                    Button("Скасувати", role: .cancel) { }
                } message: {
                    Text("Особистий бюджет залишиться на пристрої та у вашому Firebase.")
                }
            } else {
                ContentUnavailableView(
                    "Сім’ю не знайдено",
                    systemImage: "person.3.sequence.fill",
                    description: Text("Можливо, вас видалили зі списку учасників.")
                )
            }
        }
    }

    private func createInvite(for family: FamilySummary) async {
        isCreatingInvite = true
        defer { isCreatingInvite = false }
        do {
            invite = try await familyStore.createInvite(for: family)
        } catch {
            errorMessage = FamilyAccountError.userFacingMessage(for: error)
        }
    }

    private func remove(_ member: FamilyMember, from family: FamilySummary) async {
        memberToRemove = nil
        do {
            try await familyStore.remove(member: member, from: family)
        } catch {
            errorMessage = FamilyAccountError.userFacingMessage(for: error)
        }
    }

    private func leave(_ family: FamilySummary) async {
        do {
            try await familyStore.leaveFamily(family)
        } catch {
            errorMessage = FamilyAccountError.userFacingMessage(for: error)
        }
    }
}

private struct FamilyMemberRow: View {
    let member: FamilyMember

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: member.role == .owner ? "crown.fill" : "person.crop.circle.fill")
                .foregroundStyle(member.role == .owner ? PlanerTheme.warning : PlanerTheme.accent)
                .frame(width: 32, height: 32)
                .background(.secondary.opacity(0.1), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(member.displayName)
                    .font(.body.weight(.medium))
                if !member.email.isEmpty {
                    Text(member.email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if member.role == .member {
                    Text(permissionSummary)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(member.role.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }

    private var permissionSummary: String {
        var permissions: [String] = []
        if member.canEditBudget { permissions.append("редагування бюджету") }
        if member.canInviteMembers { permissions.append("запрошення") }
        return permissions.isEmpty ? "лише перегляд" : permissions.joined(separator: " · ")
    }
}

private struct FamilyMemberPermissionsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyAccountStore.self) private var familyStore
    let familyID: String
    let member: FamilyMember
    @State private var canEditBudget: Bool
    @State private var canInviteMembers: Bool
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(familyID: String, member: FamilyMember) {
        self.familyID = familyID
        self.member = member
        _canEditBudget = State(initialValue: member.canEditBudget)
        _canInviteMembers = State(initialValue: member.canInviteMembers)
    }

    var body: some View {
        Form {
            Section {
                LabeledContent("Учасник", value: member.displayName)
                if !member.email.isEmpty {
                    LabeledContent("Email", value: member.email)
                }
            }

            Section {
                Toggle("Змінювати сімейний бюджет", isOn: $canEditBudget)
                Toggle("Запрошувати учасників", isOn: $canInviteMembers)
            } header: {
                Text("Дозволи")
            } footer: {
                Text("Без дозволу на зміни учасник бачить бюджет, але не може додавати або видаляти гаманці, операції, цілі, борги та чеки.")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(PlanerTheme.negative)
                }
            }
        }
        .navigationTitle("Права учасника")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isSaving)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
                    .disabled(isSaving)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "Зберігаємо…" : "Зберегти") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
    }

    private func save() async {
        guard let family = familyStore.families.first(where: { $0.id == familyID }) else {
            errorMessage = "Сімейний простір більше не існує."
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            try await familyStore.updatePermissions(
                for: member,
                in: family,
                canEditBudget: canEditBudget,
                canInviteMembers: canInviteMembers
            )
            dismiss()
        } catch {
            errorMessage = FamilyAccountError.userFacingMessage(for: error)
        }
    }
}
