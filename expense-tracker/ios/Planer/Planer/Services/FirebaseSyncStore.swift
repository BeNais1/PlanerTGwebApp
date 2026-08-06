import FirebaseDatabase
import Foundation
import Observation

@MainActor
@Observable
final class FirebaseSyncStore {
    struct ReceiptShareLink: Equatable {
        let code: String
        let url: URL
    }

    enum Status: Equatable {
        case connecting
        case synced(Date)
        case error(String)

        var title: String {
            switch self {
            case .connecting:
                "Синхронізація…"
            case .synced:
                "Дані синхронізовано"
            case .error:
                "Помилка синхронізації"
            }
        }
    }

    private(set) var status: Status = .connecting

    @ObservationIgnored private let user: AuthenticatedUser
    @ObservationIgnored private var reference: DatabaseReference?
    @ObservationIgnored private var observerHandle: DatabaseHandle?
    @ObservationIgnored private weak var store: FinanceStore?
    @ObservationIgnored private var receivedInitialSnapshot = false
    @ObservationIgnored private var activeSpaceID: String?
    @ObservationIgnored private var activeSpace: FinanceSpace?

    init(user: AuthenticatedUser) {
        self.user = user
    }

    static func preview() -> FirebaseSyncStore {
        let syncStore = FirebaseSyncStore(
            user: AuthenticatedUser(
                id: "preview-user",
                displayName: "Boris",
                email: "boris@example.com",
                photoURL: nil
            )
        )
        syncStore.status = .synced(.now)
        return syncStore
    }

    func start(store: FinanceStore, space: FinanceSpace) {
        switchSpace(to: space, store: store)
    }

    func switchSpace(to space: FinanceSpace, store: FinanceStore) {
        guard activeSpaceID != space.id || observerHandle == nil else { return }
        stop()
        activeSpaceID = space.id
        activeSpace = space
        self.store = store
        status = .connecting

        store.switchStorageNamespace(space.cacheNamespace, fallbackSpaceName: space.title)

        let userReference = Database.database().reference().child("users").child(user.id)
        userReference.updateChildValues([
            "profile/displayName": user.displayName,
            "profile/email": user.email,
            "profile/lastLoginAt": ServerValue.timestamp()
        ])

        let reference: DatabaseReference
        switch space {
        case .personal:
            reference = userReference.child("iosSnapshot")
        case .family(let familyID, _):
            reference = Database.database().reference()
                .child("families")
                .child(familyID)
                .child("iosSnapshot")
        }
        self.reference = reference
        observerHandle = reference.observe(
            .value,
            with: { [weak self, weak store] snapshot in
                Task { @MainActor in
                    guard let self, let store else { return }
                    await self.receive(snapshot, store: store)
                }
            },
            withCancel: { [weak self] error in
                Task { @MainActor in
                    self?.report(error)
                }
            }
        )
    }

    func stop() {
        store?.setChangeHandler(nil)
        if let observerHandle {
            reference?.removeObserver(withHandle: observerHandle)
        }
        observerHandle = nil
        reference = nil
        store = nil
        receivedInitialSnapshot = false
        activeSpaceID = nil
        activeSpace = nil
    }

    func publish(receipt: ReceiptSummary) async throws -> ReceiptShareLink {
        let receiptID = receipt.transactionID?.uuidString ?? receipt.id.uuidString
        let mappingReference = Database.database().reference()
            .child("user_shares")
            .child(user.id)
            .child(receiptID)

        let existingValue = try await readValue(from: mappingReference)
        let shareCode = (existingValue as? String).flatMap(Self.validShareCode) ?? Self.makeShareCode()
        let now = Date.now.timeIntervalSince1970 * 1_000
        let transactionDate = receipt.date.timeIntervalSince1970 * 1_000
        let monthFormatter = DateFormatter()
        monthFormatter.locale = Locale(identifier: "en_US_POSIX")
        monthFormatter.dateFormat = "yyyy-MM"

        var transaction: [String: Any] = [
            "id": receiptID,
            "type": (receipt.transactionKind ?? .expense).rawValue,
            "amount": receipt.amount,
            "currency": receipt.currency.rawValue,
            "category": receipt.categoryTitle ?? "Інше",
            "categoryName": receipt.categoryTitle ?? "Інше",
            "categoryIcon": receipt.categorySystemImage ?? "receipt.fill",
            "description": receipt.note ?? receipt.merchant,
            "merchant": receipt.merchant,
            "date": transactionDate,
            "month": monthFormatter.string(from: receipt.date)
        ]
        if let walletName = receipt.walletName { transaction["walletName"] = walletName }

        let shareData: [String: Any] = [
            "id": shareCode,
            "receiptId": receiptID,
            "ownerId": user.id,
            "shareCode": shareCode,
            "isActive": true,
            "privacyMode": "public",
            "transaction": transaction,
            "ownerName": receipt.authorName ?? user.displayName,
            "createdAt": receipt.createdAt.map { $0.timeIntervalSince1970 * 1_000 } ?? now,
            "updatedAt": now
        ]

        try await updateValues([
            "shared_receipts/\(shareCode)": shareData,
            "user_shares/\(user.id)/\(receiptID)": shareCode
        ])

        guard let url = URL(string: "planer://receipt/\(shareCode)") else {
            throw FirebaseSyncError.encodingFailed
        }
        return ReceiptShareLink(code: shareCode, url: url)
    }

    func fetchSharedReceipt(code: String) async throws -> ReceiptSummary {
        guard let validCode = Self.validShareCode(code) else { throw FirebaseSyncError.invalidReceiptLink }
        let value = try await readValue(
            from: Database.database().reference().child("shared_receipts").child(validCode)
        )
        guard let share = value as? [String: Any],
              (share["isActive"] as? Bool) != false,
              let transaction = share["transaction"] as? [String: Any],
              let amount = (transaction["amount"] as? NSNumber)?.doubleValue,
              let currencyRaw = transaction["currency"] as? String,
              let currency = Currency(rawValue: currencyRaw) else {
            throw FirebaseSyncError.receiptNotFound
        }

        let receiptID = (share["receiptId"] as? String).flatMap(UUID.init(uuidString:)) ?? UUID()
        let dateMilliseconds = (transaction["date"] as? NSNumber)?.doubleValue ?? 0
        let kindRaw = transaction["type"] as? String
        let kind = kindRaw.flatMap(FinanceTransactionKind.init(rawValue:)) ?? .expense
        let merchant = transaction["merchant"] as? String
            ?? transaction["description"] as? String
            ?? "Цифровий чек"

        return ReceiptSummary(
            id: receiptID,
            merchant: merchant,
            amount: amount,
            currency: currency,
            date: Date(timeIntervalSince1970: dateMilliseconds / 1_000),
            isShared: true,
            transactionID: receiptID,
            categoryTitle: transaction["categoryName"] as? String ?? transaction["category"] as? String,
            categorySystemImage: transaction["categoryIcon"] as? String,
            transactionKind: kind,
            note: transaction["description"] as? String,
            walletName: transaction["walletName"] as? String,
            authorName: share["ownerName"] as? String,
            shareCode: validCode,
            createdAt: (share["createdAt"] as? NSNumber).map {
                Date(timeIntervalSince1970: $0.doubleValue / 1_000)
            }
        )
    }

    @discardableResult
    func revokeSharedReceipt(_ receipt: ReceiptSummary) async throws -> Bool {
        guard let code = receipt.shareCode.flatMap(Self.validShareCode) else { return false }
        let sharedReference = Database.database().reference().child("shared_receipts").child(code)
        guard let share = try await readValue(from: sharedReference) as? [String: Any],
              share["ownerId"] as? String == user.id else {
            return false
        }

        let receiptID = (share["receiptId"] as? String)
            ?? receipt.transactionID?.uuidString
            ?? receipt.id.uuidString
        try await updateValues([
            "shared_receipts/\(code)/isActive": false,
            "shared_receipts/\(code)/updatedAt": Date.now.timeIntervalSince1970 * 1_000,
            "user_shares/\(user.id)/\(receiptID)": NSNull()
        ])
        return true
    }

    private static func validShareCode(_ value: String) -> String? {
        value.range(of: #"^[A-Za-z0-9_-]{8,32}$"#, options: .regularExpression) == nil ? nil : value
    }

    private static func makeShareCode() -> String {
        let characters = Array("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789")
        return String((0..<8).compactMap { _ in characters.randomElement() })
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

    private func receive(_ dataSnapshot: DataSnapshot, store: FinanceStore) async {
        do {
            if dataSnapshot.exists(), let remote = try decodeSnapshot(from: dataSnapshot) {
                if receivedInitialSnapshot,
                   let activeSpace,
                   case .family(_, let familyName) = activeSpace {
                    await PlanerNotificationService.shared.notifyFamilyChanges(
                        previous: store.snapshot,
                        current: remote,
                        familyName: familyName,
                        currentUserName: user.displayName
                    )
                }
                store.replace(with: remote)

                let schemaVersion = dataSnapshot.childSnapshot(forPath: "schemaVersion").value as? NSNumber
                if schemaVersion?.intValue != 2 {
                    try await upload(remote)
                }
            } else if !receivedInitialSnapshot {
                try await upload(store.snapshot)
            }

            if !receivedInitialSnapshot {
                receivedInitialSnapshot = true
                store.setChangeHandler { [weak self] snapshot in
                    Task { @MainActor in
                        await self?.uploadSafely(snapshot)
                    }
                }
            }
            status = .synced(.now)
        } catch {
            report(error)
        }
    }

    private func uploadSafely(_ snapshot: PlanerSnapshot) async {
        do {
            try await upload(snapshot)
            status = .synced(.now)
        } catch {
            report(error)
        }
    }

    private func upload(_ snapshot: PlanerSnapshot) async throws {
        guard let reference else { throw FirebaseSyncError.missingReference }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        let data = try encoder.encode(snapshot)
        guard let snapshotJSON = String(data: data, encoding: .utf8) else {
            throw FirebaseSyncError.encodingFailed
        }
        let value: [String: Any] = [
            "schemaVersion": 2,
            "snapshotJSON": snapshotJSON,
            "updatedAt": ServerValue.timestamp()
        ]

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

    private func decodeSnapshot(from dataSnapshot: DataSnapshot) throws -> PlanerSnapshot? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970

        if let snapshotJSON = dataSnapshot.childSnapshot(forPath: "snapshotJSON").value as? String,
           let data = snapshotJSON.data(using: .utf8) {
            return try decoder.decode(PlanerSnapshot.self, from: data)
        }

        guard let value = dataSnapshot.childSnapshot(forPath: "snapshot").value else { return nil }
        let data = try JSONSerialization.data(withJSONObject: value)
        return try decoder.decode(PlanerSnapshot.self, from: data)
    }

    private func report(_ error: Error) {
        print("Firebase sync error: \(error)")
        status = .error(FirebaseSyncError.userFacingMessage(for: error))
    }
}

private enum FirebaseSyncError: LocalizedError {
    case missingReference
    case encodingFailed
    case invalidReceiptLink
    case receiptNotFound

    var errorDescription: String? {
        switch self {
        case .missingReference:
            "З’єднання з Firebase ще не готове."
        case .encodingFailed:
            "Не вдалося підготувати дані для синхронізації."
        case .invalidReceiptLink:
            "Посилання на чек має неправильний формат."
        case .receiptNotFound:
            "Чек не знайдено або автор вимкнув посилання."
        }
    }

    static func userFacingMessage(for error: Error) -> String {
        if let localizedError = error as? FirebaseSyncError {
            return localizedError.errorDescription ?? "Невідома помилка Firebase."
        }
        if error is DecodingError {
            return "Дані в Firebase мають несумісний формат. Оновіть їх або видаліть хмарну копію."
        }
        return "Не вдалося з’єднатися з Firebase. Перевірте інтернет і правила доступу до бази даних."
    }
}
