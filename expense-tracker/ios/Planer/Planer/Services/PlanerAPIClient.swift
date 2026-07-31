import Foundation

struct APIHealth: Decodable {
    let status: String?
    let service: String?
}

enum PlanerAPIError: Error {
    case invalidResponse
    case server(statusCode: Int)
}

/// Narrow integration seam for the existing Express backend.
/// Personal wallets and transactions are intentionally not wired because the web app
/// currently reads them directly from Firebase after Telegram Mini App authentication.
struct PlanerAPIClient {
    var baseURL: URL
    var session: URLSession = .shared

    func health() async throws -> APIHealth {
        let url = baseURL.appending(path: "health")
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PlanerAPIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw PlanerAPIError.server(statusCode: httpResponse.statusCode)
        }
        return try JSONDecoder().decode(APIHealth.self, from: data)
    }
}
