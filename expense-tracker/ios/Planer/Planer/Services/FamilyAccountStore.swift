import FirebaseDatabase
import Foundation
import Observation

@MainActor
@Observable
final class FamilyAccountStore {
    enum Status: Equatable {
        case loading
        case ready
        case error(String)
    }

    private(set) var families: [FamilySummary] = []
    private(set) var activeSpace: FinanceSpace
    private(set) var status: Status = .loading

    @ObservationIgnored private let user: AuthenticatedUser
    @ObservationIgnored private let activeFamilyKey: String
    @ObservationIgnored private var membershipsReference: DatabaseReference?
    @ObservationIgnored private var membershipsHandle: DatabaseHandle?

    init(user: AuthenticatedUser) {
        self.user = user
        activeFamilyKey = "planer.activeFamily.\(user.id)"
        if let familyID = UserDefaults.standard.string(forKey: activeFamilyKey) {
            activeSpace = .family(id: familyID, name: "Сімейний бюджет")
        } else {
            activeSpace = .personal(userID: user.id)
        }
    }

    static func preview() -> FamilyAccountStore {
        let user = AuthenticatedUser(
            id: "preview-user",
            displayName: "Борис",
            email: "boris@example.com",
            photoURL: nil
        )
        let store = FamilyAccountStore(user: user)
        store.families = [
            FamilySummary(
                id: "preview-family",
                name: "Родина Богатирів",
                ownerID: user.id,
                createdAt: .now,
                members: [
                    FamilyMember(
                        userID: user.id,
                        displayName: user.displayName,
                        email: user.email,
                        role: .owner,
                        joinedAt: .now
                    ),
                    FamilyMember(
                        userID: "preview-member",
                        displayName: "Марія",
                        email: "maria@example.com",
                        role: .member,
                        joinedAt: .now
                    )
                ]
            )
        ]
        store.status = .ready
        return store
    }

    var currentUserID: String { user.id }

    var activeFamily: FamilySummary? {
        guard let familyID = activeSpace.familyID else { return nil }
        return families.first { $0.id == familyID }
    }

    func start() {
        guard membershipsHandle == nil else { return }
        status = .loading

        let reference = Database.database().reference()
            .child("user_families")
            .child(user.id)
        membershipsReference = reference
        membershipsHandle = reference.observe(
            .value,
            with: { [weak self] snapshot in
                Task { @MainActor in
                    await self?.refreshFamilies(from: snapshot)
                }
            },
            withCancel: { [weak self] error in
                Task { @MainActor in
                    self?.status = .error(FamilyAccountError.userFacingMessage(for: error))
                }
            }
        )
    }

    func stop() {
        if let membershipsHandle {
            membershipsReference?.removeObserver(withHandle: membershipsHandle)
        }
        membershipsHandle = nil
        membershipsReference = nil
    }

    func selectPersonalSpace() {
        activeSpace = .personal(userID: user.id)
        UserDefaults.standard.removeObject(forKey: activeFamilyKey)
    }

    func selectFamily(_ family: FamilySummary) {
        guard family.member(id: user.id) != nil else { return }
        activeSpace = .family(id: family.id, name: family.name)
        UserDefaults.standard.set(family.id, forKey: activeFamilyKey)
    }

    @discardableResult
    func createFamily(
        name: String,
        mainCurrency: Currency,
        prefersDarkAppearance: Bool
    ) async throws -> FamilySummary {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...40).contains(trimmedName.count) else {
            throw FamilyAccountError.invalidFamilyName
        }

        let root = Database.database().reference()
        guard let familyID = root.child("families").childByAutoId().key else {
            throw FamilyAccountError.couldNotCreateIdentifier
        }

        let now = Date.now
        let owner = FamilyMember(
            userID: user.id,
            displayName: user.displayName,
            email: user.email,
            role: .owner,
            joinedAt: now
        )
        var emptySnapshot = PlanerSnapshot.empty
        emptySnapshot.mainCurrency = mainCurrency
        emptySnapshot.prefersDarkAppearance = prefersDarkAppearance
        emptySnapshot.activeSpaceName = trimmedName

        let familyData: [String: Any] = [
            "id": familyID,
            "name": trimmedName,
            "ownerId": user.id,
            "createdAt": now.millisecondsSince1970,
            "members": [user.id: Self.firebaseValue(for: owner)],
            "iosSnapshot": try Self.firebaseSnapshotValue(emptySnapshot)
        ]

        try await setValue(familyData, at: root.child("families").child(familyID))
        try await updateValues([
            "user_families/\(user.id)/\(familyID)": true
        ])

        let family = FamilySummary(
            id: familyID,
            name: trimmedName,
            ownerID: user.id,
            createdAt: now,
            members: [owner]
        )
        families.removeAll { $0.id == familyID }
        families.append(family)
        families.sort { $0.createdAt < $1.createdAt }
        status = .ready
        selectFamily(family)
        return family
    }

    func createInvite(for family: FamilySummary) async throws -> FamilyInvite {
        guard family.member(id: user.id) != nil else {
            throw FamilyAccountError.notFamilyMember
        }

        let code = Self.makeInviteCode()
        let expiresAt = Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now
        let data: [String: Any] = [
            "code": code,
            "familyId": family.id,
            "familyName": family.name,
            "createdBy": user.id,
            "createdAt": Date.now.millisecondsSince1970,
            "expiresAt": expiresAt.millisecondsSince1970,
            "isActive": true
        ]
        try await setValue(
            data,
            at: Database.database().reference().child("family_invites").child(code)
        )
        return FamilyInvite(
            code: code,
            familyID: family.id,
            familyName: family.name,
            createdBy: user.id,
            expiresAt: expiresAt
        )
    }

    func resolveInvite(codeOrLink: String) async throws -> FamilyInvite {
        guard let code = FamilyInviteLink.code(from: codeOrLink) else {
            throw FamilyAccountError.invalidInvite
        }
        let value = try await readValue(
            from: Database.database().reference().child("family_invites").child(code)
        )
        guard let data = value as? [String: Any],
              (data["isActive"] as? Bool) == true,
              let familyID = data["familyId"] as? String,
              let familyName = data["familyName"] as? String,
              let createdBy = data["createdBy"] as? String,
              let expiresMilliseconds = (data["expiresAt"] as? NSNumber)?.doubleValue else {
            throw FamilyAccountError.inviteNotFound
        }

        let expiresAt = Date(timeIntervalSince1970: expiresMilliseconds / 1_000)
        guard expiresAt > .now else { throw FamilyAccountError.inviteExpired }
        return FamilyInvite(
            code: code,
            familyID: familyID,
            familyName: familyName,
            createdBy: createdBy,
            expiresAt: expiresAt
        )
    }

    @discardableResult
    func join(codeOrLink: String) async throws -> FamilySummary {
        let invite = try await resolveInvite(codeOrLink: codeOrLink)
        let root = Database.database().reference()
        let member = FamilyMember(
            userID: user.id,
            displayName: user.displayName,
            email: user.email,
            role: .member,
            joinedAt: .now
        )
        var memberValue = Self.firebaseValue(for: member)
        memberValue["inviteCode"] = invite.code

        try await updateValues([
            "families/\(invite.familyID)/members/\(user.id)": memberValue,
            "user_families/\(user.id)/\(invite.familyID)": true
        ])

        guard let familyData = try await readValue(
            from: root.child("families").child(invite.familyID)
        ) as? [String: Any],
              let joinedFamily = Self.family(from: familyData, id: invite.familyID) else {
            throw FamilyAccountError.familyNotFound
        }
        families.removeAll { $0.id == joinedFamily.id }
        families.append(joinedFamily)
        families.sort { $0.createdAt < $1.createdAt }
        status = .ready
        selectFamily(joinedFamily)
        return joinedFamily
    }

    func leaveFamily(_ family: FamilySummary) async throws {
        guard family.ownerID != user.id else { throw FamilyAccountError.ownerCannotLeave }
        try await updateValues([
            "families/\(family.id)/members/\(user.id)": NSNull(),
            "user_families/\(user.id)/\(family.id)": NSNull()
        ])
        families.removeAll { $0.id == family.id }
        if activeSpace.familyID == family.id {
            selectPersonalSpace()
        }
    }

    func remove(member: FamilyMember, from family: FamilySummary) async throws {
        guard family.ownerID == user.id else { throw FamilyAccountError.ownerPermissionRequired }
        guard member.userID != family.ownerID else { throw FamilyAccountError.cannotRemoveOwner }
        try await updateValues([
            "families/\(family.id)/members/\(member.userID)": NSNull(),
            "user_families/\(member.userID)/\(family.id)": NSNull()
        ])
        if let index = families.firstIndex(where: { $0.id == family.id }) {
            let current = families[index]
            families[index] = FamilySummary(
                id: current.id,
                name: current.name,
                ownerID: current.ownerID,
                createdAt: current.createdAt,
                members: current.members.filter { $0.userID != member.userID }
            )
        }
    }

    private func refreshFamilies(from snapshot: DataSnapshot) async {
        let ids = (snapshot.value as? [String: Any])?.keys.sorted() ?? []
        do {
            var loaded: [FamilySummary] = []
            for id in ids {
                if let value = try await readValue(
                    from: Database.database().reference().child("families").child(id)
                ) as? [String: Any],
                   let family = Self.family(from: value, id: id) {
                    loaded.append(family)
                }
            }
            families = loaded.sorted { $0.createdAt < $1.createdAt }

            if let activeFamilyID = activeSpace.familyID {
                if let activeFamily = families.first(where: { $0.id == activeFamilyID }) {
                    activeSpace = .family(id: activeFamily.id, name: activeFamily.name)
                } else {
                    selectPersonalSpace()
                }
            }
            status = .ready
        } catch {
            status = .error(FamilyAccountError.userFacingMessage(for: error))
        }
    }

    private static func family(from data: [String: Any], id: String) -> FamilySummary? {
        guard let name = data["name"] as? String,
              let ownerID = data["ownerId"] as? String else {
            return nil
        }
        let createdMilliseconds = (data["createdAt"] as? NSNumber)?.doubleValue ?? 0
        let membersData = data["members"] as? [String: Any] ?? [:]
        let members = membersData.compactMap { userID, value -> FamilyMember? in
            guard let member = value as? [String: Any] else { return nil }
            let joinedMilliseconds = (member["joinedAt"] as? NSNumber)?.doubleValue ?? 0
            return FamilyMember(
                userID: userID,
                displayName: member["displayName"] as? String ?? "Учасник",
                email: member["email"] as? String ?? "",
                role: FamilyMemberRole(rawValue: member["role"] as? String ?? "member") ?? .member,
                joinedAt: Date(timeIntervalSince1970: joinedMilliseconds / 1_000)
            )
        }
        .sorted { lhs, rhs in
            if lhs.role != rhs.role { return lhs.role == .owner }
            return lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
        }

        return FamilySummary(
            id: id,
            name: name,
            ownerID: ownerID,
            createdAt: Date(timeIntervalSince1970: createdMilliseconds / 1_000),
            members: members
        )
    }

    private static func firebaseValue(for member: FamilyMember) -> [String: Any] {
        [
            "userId": member.userID,
            "displayName": member.displayName,
            "email": member.email,
            "role": member.role.rawValue,
            "joinedAt": member.joinedAt.millisecondsSince1970
        ]
    }

    private static func firebaseSnapshotValue(_ snapshot: PlanerSnapshot) throws -> [String: Any] {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        let data = try encoder.encode(snapshot)
        guard let json = String(data: data, encoding: .utf8) else {
            throw FamilyAccountError.encodingFailed
        }
        return [
            "schemaVersion": 2,
            "snapshotJSON": json,
            "updatedAt": ServerValue.timestamp()
        ]
    }

    private static func makeInviteCode() -> String {
        let characters = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        return String((0..<10).compactMap { _ in characters.randomElement() })
    }

    private func readValue(from reference: DatabaseReference) async throws -> Any? {
        try await withCheckedThrowingContinuation { continuation in
            reference.observeSingleEvent(
                of: .value,
                with: { snapshot in continuation.resume(returning: snapshot.value) },
                withCancel: { error in continuation.resume(throwing: error) }
            )
        }
    }

    private func setValue(_ value: Any, at reference: DatabaseReference) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            reference.setValue(value) { error, _ in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    private func updateValues(_ values: [AnyHashable: Any]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Database.database().reference().updateChildValues(values) { error, _ in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }
}

private extension Date {
    var millisecondsSince1970: Double { timeIntervalSince1970 * 1_000 }
}

enum FamilyAccountError: LocalizedError {
    case invalidFamilyName
    case couldNotCreateIdentifier
    case invalidInvite
    case inviteNotFound
    case inviteExpired
    case familyNotFound
    case notFamilyMember
    case ownerCannotLeave
    case ownerPermissionRequired
    case cannotRemoveOwner
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidFamilyName:
            "Назва сім’ї має містити від 2 до 40 символів."
        case .couldNotCreateIdentifier:
            "Не вдалося створити сімейний простір."
        case .invalidInvite:
            "Посилання або код запрошення має неправильний формат."
        case .inviteNotFound:
            "Запрошення не знайдено або його вже вимкнено."
        case .inviteExpired:
            "Термін дії цього запрошення завершився."
        case .familyNotFound:
            "Сімейний простір більше не існує."
        case .notFamilyMember:
            "Ви не є учасником цієї сім’ї."
        case .ownerCannotLeave:
            "Власник не може вийти із сім’ї. Спочатку потрібно передати керування."
        case .ownerPermissionRequired:
            "Ця дія доступна лише власнику сім’ї."
        case .cannotRemoveOwner:
            "Власника сім’ї неможливо видалити зі списку учасників."
        case .encodingFailed:
            "Не вдалося підготувати сімейний бюджет для Firebase."
        }
    }

    static func userFacingMessage(for error: Error) -> String {
        if let familyError = error as? FamilyAccountError {
            return familyError.errorDescription ?? "Невідома помилка сімейного простору."
        }
        return "Не вдалося синхронізувати сімейний простір. Перевірте інтернет і правила Firebase."
    }
}
