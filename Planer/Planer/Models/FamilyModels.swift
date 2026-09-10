import Foundation

enum FinanceSpace: Hashable, Identifiable {
    case personal(userID: String)
    case family(id: String, name: String)

    var id: String {
        switch self {
        case .personal:
            "personal"
        case .family(let id, _):
            "family-\(id)"
        }
    }

    var title: String {
        switch self {
        case .personal:
            "Особистий бюджет"
        case .family(_, let name):
            name
        }
    }

    var familyID: String? {
        guard case .family(let id, _) = self else { return nil }
        return id
    }

    var cacheNamespace: String {
        switch self {
        case .personal(let userID):
            userID
        case .family(let id, _):
            "family.\(id)"
        }
    }
}

enum FamilyMemberRole: String, Hashable {
    case owner
    case member

    var title: String {
        switch self {
        case .owner: "Власник"
        case .member: "Учасник"
        }
    }
}

struct FamilyMember: Identifiable, Hashable {
    let userID: String
    let displayName: String
    let email: String
    let role: FamilyMemberRole
    let joinedAt: Date
    let canEditBudget: Bool
    let canInviteMembers: Bool

    var id: String { userID }

    var effectiveCanEditBudget: Bool { role == .owner || canEditBudget }
    var effectiveCanInviteMembers: Bool { role == .owner || canInviteMembers }
}

struct FamilySummary: Identifiable, Hashable {
    let id: String
    let name: String
    let ownerID: String
    let createdAt: Date
    let members: [FamilyMember]

    func member(id: String) -> FamilyMember? {
        members.first { $0.userID == id }
    }
}

struct FamilyInvite: Identifiable, Hashable {
    let code: String
    let familyID: String
    let familyName: String
    let createdBy: String
    let expiresAt: Date

    var id: String { code }

    var url: URL {
        URL(string: "planer://family/join/\(code)")!
    }
}

enum FamilyInviteLink {
    private static let codePattern = #"^[A-Za-z0-9_-]{8,32}$"#

    static func code(from rawValue: String) -> String? {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if isValid(code: value) {
            return value
        }

        guard let url = URL(string: value) else { return nil }
        if url.scheme == "planer", url.host == "family" {
            let components = url.pathComponents.filter { $0 != "/" }
            guard components.count == 2, components[0] == "join" else { return nil }
            return isValid(code: components[1]) ? components[1] : nil
        }

        guard url.pathComponents.count >= 3 else { return nil }
        let components = url.pathComponents.filter { $0 != "/" }
        guard components.suffix(3).dropLast().elementsEqual(["family", "join"]),
              let code = components.last,
              isValid(code: code) else {
            return nil
        }
        return code
    }

    static func isValid(code: String) -> Bool {
        code.range(of: codePattern, options: .regularExpression) != nil
    }
}
