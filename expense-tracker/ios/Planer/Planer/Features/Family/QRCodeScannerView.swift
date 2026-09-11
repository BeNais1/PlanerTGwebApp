import AVFoundation
import SwiftUI
import UIKit

struct QRCodeScannerView: UIViewControllerRepresentable {
    let onResult: (String) -> Void
    let onError: (String) -> Void

    func makeUIViewController(context: Context) -> QRCodeScannerViewController {
        QRCodeScannerViewController(onResult: onResult, onError: onError)
    }

    func updateUIViewController(_ uiViewController: QRCodeScannerViewController, context: Context) { }

    static func dismantleUIViewController(
        _ uiViewController: QRCodeScannerViewController,
        coordinator: Void
    ) {
        uiViewController.stopScanning()
    }
}

final class QRCodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let captureSession = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "planer.qr-scanner.session")
    private let onResult: (String) -> Void
    private let onError: (String) -> Void
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var isConfigured = false
    private var hasDeliveredResult = false

    init(onResult: @escaping (String) -> Void, onError: @escaping (String) -> Void) {
        self.onResult = onResult
        self.onError = onError
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        requestCameraAndStart()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    func stopScanning() {
        sessionQueue.async { [captureSession] in
            if captureSession.isRunning {
                captureSession.stopRunning()
            }
        }
    }

    private func requestCameraAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureAndStart()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.configureAndStart()
                    } else {
                        self?.onError("Надайте Planer доступ до камери в налаштуваннях iPhone.")
                    }
                }
            }
        case .denied, .restricted:
            onError("Надайте Planer доступ до камери в налаштуваннях iPhone.")
        @unknown default:
            onError("Не вдалося перевірити доступ до камери.")
        }
    }

    private func configureAndStart() {
        guard !isConfigured else {
            startSession()
            return
        }

        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              captureSession.canAddInput(input) else {
            onError("Камера недоступна на цьому пристрої.")
            return
        }

        let output = AVCaptureMetadataOutput()
        guard captureSession.canAddOutput(output) else {
            onError("Не вдалося запустити сканер QR-кодів.")
            return
        }

        captureSession.beginConfiguration()
        captureSession.addInput(input)
        captureSession.addOutput(output)
        captureSession.commitConfiguration()

        output.setMetadataObjectsDelegate(self, queue: .main)
        guard output.availableMetadataObjectTypes.contains(.qr) else {
            onError("Ця камера не підтримує сканування QR-кодів.")
            return
        }
        output.metadataObjectTypes = [.qr]

        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)
        self.previewLayer = previewLayer
        isConfigured = true
        startSession()
    }

    private func startSession() {
        sessionQueue.async { [captureSession] in
            if !captureSession.isRunning {
                captureSession.startRunning()
            }
        }
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard !hasDeliveredResult,
              let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              object.type == .qr,
              let value = object.stringValue else {
            return
        }
        hasDeliveredResult = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        stopScanning()
        onResult(value)
    }
}

struct FamilyQRScannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onCode: (String) -> Void
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                QRCodeScannerView(
                    onResult: { value in
                        if let code = FamilyInviteLink.code(from: value) {
                            onCode(code)
                            dismiss()
                        } else {
                            errorMessage = "Цей QR-код не містить запрошення до сім’ї Planer."
                        }
                    },
                    onError: { errorMessage = $0 }
                )
                .ignoresSafeArea()

                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(.white, lineWidth: 3)
                    .frame(width: 260, height: 260)
                    .shadow(color: .black.opacity(0.35), radius: 16)

                VStack {
                    Spacer()
                    Text("Наведіть камеру на QR-код запрошення")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 22)
                        .padding(.vertical, 14)
                        .background(.black.opacity(0.65), in: Capsule())
                        .padding(.bottom, 32)
                }
            }
            .navigationTitle("Сканувати QR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Закрити") { dismiss() }
                }
            }
            .alert("Не вдалося відсканувати", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("Гаразд", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "Невідома помилка")
            }
        }
    }
}
