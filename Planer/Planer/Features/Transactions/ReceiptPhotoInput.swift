import SwiftUI
import PhotosUI
import Vision
import VisionKit

struct ReceiptPhotoInput: View {
    let onRecognized: (ReceiptDraft) -> Void
    @State private var selection: PhotosPickerItem?
    @State private var scanning = false
    @State private var busy = false
    @State private var errorMessage: String?

    var body: some View {
        Section {
            HStack {
                PhotosPicker(selection: $selection, matching: .images) {
                    Label("Фото чека", systemImage: "photo")
                }
                Spacer()
                if VNDocumentCameraViewController.isSupported {
                    Button { scanning = true } label: { Label("Камера", systemImage: "camera") }
                }
            }
            .disabled(busy)
            if busy { ProgressView("Розпізнавання…") }
            if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
        }
        .task(id: selection) {
            guard let selection else { return }
            busy = true
            errorMessage = nil
            defer { busy = false }
            do {
                guard let data = try await selection.loadTransferable(type: Data.self) else { throw PhotoError.unreadable }
                let draft = try await Self.recognize(data)
                try Task.checkCancellation()
                onRecognized(draft)
            } catch is CancellationError { } catch { errorMessage = "Не вдалося прочитати чек. Спробуйте чіткіше фото або введіть суму." }
        }
        .sheet(isPresented: $scanning) {
            ReceiptCamera { result in
                scanning = false
                switch result {
                case .success(let data):
                    Task {
                        busy = true
                        errorMessage = nil
                        defer { busy = false }
                        do { onRecognized(try await Self.recognize(data)) }
                        catch { errorMessage = "Не вдалося прочитати чек. Спробуйте інше фото." }
                    }
                case .failure: errorMessage = "Камера недоступна. Можна обрати фото з галереї."
                }
            }
        }
    }

    nonisolated static func recognize(_ data: Data) async throws -> ReceiptDraft {
        try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let supported = try request.supportedRecognitionLanguages()
            request.recognitionLanguages = ["uk-UA", "ru-RU", "en-US"].filter { supported.contains($0) }
            let handler = VNImageRequestHandler(data: data)
            try handler.perform([request])
            let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
            guard !text.isEmpty else { throw PhotoError.unreadable }
            return ReceiptParser.parse(text)
        }.value
    }
}

private enum PhotoError: Error { case unreadable }

private struct ReceiptCamera: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let completion: (Result<Data, Error>) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }
    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) { }
    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let parent: ReceiptCamera
        init(parent: ReceiptCamera) { self.parent = parent }
        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { parent.dismiss() }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) { parent.completion(.failure(error)) }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            guard scan.pageCount > 0, let data = scan.imageOfPage(at: 0).jpegData(compressionQuality: 0.9) else {
                parent.completion(.failure(PhotoError.unreadable)); return
            }
            parent.completion(.success(data))
        }
    }
}
