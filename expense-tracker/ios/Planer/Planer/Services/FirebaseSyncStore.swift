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
                "Синхронизация…"
            case .synced:
                "Данные синхронизированы"
            case .error:
                "Ошибка синхронизации"
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
                    self?.status = .error(error.localizedDescription)
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
            status = .error(error.localizedDescription)
        }
    }

    private func uploadSafely(_ snapshot: PlanerSnapshot) async {
        do {
            try await upload(snapshot)
            status = .synced(.now)
        } catch {
            status = .error(error.localizedDescription)
        }
    }

    private func upload(_ snapshot: PlanerSnapshot) async throws {
        guard let reference else { throw FirebaseSyncError.missingReference }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        let data = try encoder.encode(snapshot)
        let snapshotValue = try JSONSerialization.jsonObject(with: data)
        let value: [String: Any] = [
            "schemaVersion": 1,
            "snapshot": snapshotValue,
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
        guard let value = dataSnapshot.childSnapshot(forPath: "snapshot").value else { return nil }
        let data = try JSONSerialization.data(withJSONObject: value)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return try decoder.decode(PlanerSnapshot.self, from: data)
    }
}

private enum FirebaseSyncError: LocalizedError {
    case missingReference

    var errorDescription: String? {
        "Firebase Database ещё не готова."
    }
}
