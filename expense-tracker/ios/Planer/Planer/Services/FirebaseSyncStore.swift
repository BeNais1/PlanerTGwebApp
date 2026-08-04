import FirebaseDatabase
import Foundation
import Observation

@MainActor
@Observable
final class FirebaseSyncStore {
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

    func start(store: FinanceStore) {
        guard observerHandle == nil else { return }
        self.store = store
        status = .connecting

        let userReference = Database.database().reference().child("users").child(user.id)
        userReference.updateChildValues([
            "profile/displayName": user.displayName,
            "profile/email": user.email,
            "profile/lastLoginAt": ServerValue.timestamp()
        ])

        let reference = userReference.child("iosSnapshot")
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
    }

    private func receive(_ dataSnapshot: DataSnapshot, store: FinanceStore) async {
        do {
            if dataSnapshot.exists(), let remote = try decodeSnapshot(from: dataSnapshot) {
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

    var errorDescription: String? {
        switch self {
        case .missingReference:
            "З’єднання з Firebase ще не готове."
        case .encodingFailed:
            "Не вдалося підготувати дані для синхронізації."
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
