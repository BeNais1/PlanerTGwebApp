import SwiftUI

struct FamilyAccountsView: View {
    @Environment(FamilyAccountStore.self) private var familyStore
    @State private var presentedSheet: FamilyAccountsSheet?

    var body: some View {
        List {
            Section("Активний простір") {
                Button {
                    familyStore.selectPersonalSpace()
                } label: {
                    SpaceRow(
                        title: "Особистий бюджет",
                        subtitle: "Тільки ваші гаманці та операції",
                        systemImage: "person.crop.circle",
                        isSelected: familyStore.activeSpace.familyID == nil
                    )
                }
                .buttonStyle(.plain)
            }

            Section("Сімейні простори") {
                if familyStore.families.isEmpty {
                    ContentUnavailableView(
                        "Сімей ще немає",
                        systemImage: "person.3",
                        description: Text("Створіть сім’ю або приєднайтеся за запрошенням.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(familyStore.families) { family in
                        NavigationLink(value: family) {
                            SpaceRow(
                                title: family.name,
                                subtitle: "Учасників: \(family.members.count)",
                                systemImage: "person.3.fill",
                                isSelected: familyStore.activeSpace.familyID == family.id
                            )
                        }
                    }
                }
            }

            Section("Додати сім’ю") {
                Button {
                    presentedSheet = .create
                } label: {
                    Label("Створити сімейний простір", systemImage: "plus.circle.fill")
                }

                Button {
                    presentedSheet = .join(code: "")
                } label: {
                    Label("Ввести код або посилання", systemImage: "link")
                }

                Button {
                    presentedSheet = .scanner
                } label: {
                    Label("Сканувати QR-код", systemImage: "qrcode.viewfinder")
                }
            }

            if case .error(let message) = familyStore.status {
                Section {
                    Label(message, systemImage: "exclamationmark.icloud.fill")
                        .foregroundStyle(PlanerTheme.negative)
                }
            }
        }
        .navigationTitle("Сімейні акаунти")
        .navigationDestination(for: FamilySummary.self) { family in
            FamilyDetailView(familyID: family.id)
        }
        .sheet(item: $presentedSheet) { sheet in
            switch sheet {
            case .create:
                NavigationStack { CreateFamilyView() }
            case .join(let code):
                NavigationStack { FamilyJoinView(codeOrLink: code) }
            case .scanner:
                FamilyQRScannerSheet { code in
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(200))
                        presentedSheet = .join(code: code)
                    }
                }
            }
        }
    }
}

private struct SpaceRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.title3)
                .foregroundStyle(isSelected ? PlanerTheme.accent : .secondary)
                .frame(width: 34, height: 34)
                .background(
                    (isSelected ? PlanerTheme.accent : Color.secondary).opacity(0.12),
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
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

private enum FamilyAccountsSheet: Identifiable {
    case create
    case join(code: String)
    case scanner

    var id: String {
        switch self {
        case .create: "create"
        case .join(let code): "join-\(code)"
        case .scanner: "scanner"
        }
    }
}

private struct CreateFamilyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyAccountStore.self) private var familyStore
    @Environment(FinanceStore.self) private var financeStore
    @State private var name = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                TextField("Наприклад, Родина Богатирів", text: $name)
                    .textInputAutocapitalization(.words)
            } header: {
                Text("Назва сім’ї")
            } footer: {
                Text("Сімейний простір починається з чистого бюджету. Усі учасники бачитимуть його спільні гаманці та операції.")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(PlanerTheme.negative)
                }
            }
        }
        .navigationTitle("Нова сім’я")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isSaving)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Скасувати") { dismiss() }
                    .disabled(isSaving)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "Створюємо…" : "Створити") {
                    Task { await createFamily() }
                }
                .disabled(isSaving || name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
            }
        }
    }

    private func createFamily() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await familyStore.createFamily(
                name: name,
                mainCurrency: financeStore.mainCurrency,
                prefersDarkAppearance: financeStore.prefersDarkAppearance
            )
            dismiss()
        } catch {
            errorMessage = FamilyAccountError.userFacingMessage(for: error)
        }
    }
}

struct FamilyJoinView: View {
    private enum LoadState {
        case idle
        case loading
        case loaded(FamilyInvite)
        case failed(String)
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyAccountStore.self) private var familyStore
    @State private var codeOrLink: String
    @State private var state: LoadState = .idle
    @State private var isJoining = false

    init(codeOrLink: String) {
        _codeOrLink = State(initialValue: codeOrLink)
    }

    var body: some View {
        Form {
            Section("Код або посилання") {
                TextField("PLANER2026", text: $codeOrLink)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onSubmit { Task { await resolveInvite() } }
                Button("Перевірити запрошення") {
                    Task { await resolveInvite() }
                }
                .disabled(codeOrLink.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            switch state {
            case .idle:
                Section {
                    Text("Вставте посилання або введіть код із запрошення.")
                        .foregroundStyle(.secondary)
                }
            case .loading:
                Section {
                    HStack {
                        ProgressView()
                        Text("Перевіряємо запрошення…")
                    }
                }
            case .loaded(let invite):
                Section("Сім’я") {
                    LabeledContent("Назва", value: invite.familyName)
                    LabeledContent(
                        "Запрошення діє до",
                        value: invite.expiresAt.formatted(date: .abbreviated, time: .shortened)
                    )
                    Button {
                        Task { await join(invite) }
                    } label: {
                        if isJoining {
                            HStack {
                                ProgressView()
                                Text("Приєднуємо…")
                            }
                        } else {
                            Label("Приєднатися до сім’ї", systemImage: "person.badge.plus")
                        }
                    }
                    .disabled(isJoining)
                }
            case .failed(let message):
                Section {
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(PlanerTheme.negative)
                }
            }
        }
        .navigationTitle("Приєднатися")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Закрити") { dismiss() }
            }
        }
        .task {
            if !codeOrLink.isEmpty {
                await resolveInvite()
            }
        }
    }

    private func resolveInvite() async {
        state = .loading
        do {
            state = .loaded(try await familyStore.resolveInvite(codeOrLink: codeOrLink))
        } catch is CancellationError {
            return
        } catch {
            state = .failed(FamilyAccountError.userFacingMessage(for: error))
        }
    }

    private func join(_ invite: FamilyInvite) async {
        isJoining = true
        defer { isJoining = false }
        do {
            try await familyStore.join(codeOrLink: invite.code)
            dismiss()
        } catch {
            state = .failed(FamilyAccountError.userFacingMessage(for: error))
        }
    }
}

#Preview("Families") {
    NavigationStack { FamilyAccountsView() }
        .environment(FamilyAccountStore.preview())
        .environment(FinanceStore.previewStore())
}
