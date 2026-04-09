import Foundation

// MARK: - API Error

enum APIError: Error, LocalizedError, Sendable {
    case invalidURL
    case unauthorized
    case badRequest(String)
    case serverError(String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "Invalid URL"
        case .unauthorized:
            "Unauthorized — please log in again"
        case .badRequest(let message):
            message
        case .serverError(let message):
            message
        case .decodingError(let error):
            "Decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            error.localizedDescription
        }
    }
}

// MARK: - Backend Error Response

private struct BackendErrorResponse: Codable {
    let message: String
    let statusCode: Int
}

// MARK: - API Client

actor APIClient {
    static let shared = APIClient()

    private let baseURL: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var token: String?

    init(baseURL: String = Config.apiBaseURL) {
        self.baseURL = baseURL

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity = true
        config.httpMaximumConnectionsPerHost = 6
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    // MARK: - GET

    func get<T: Codable & Sendable>(
        path: String,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "GET", queryItems: queryItems)
            self.applyAuth(&request)
            return try await self.perform(request)
        }
    }

    // MARK: - POST with response

    func post<T: Codable & Sendable, B: Codable & Sendable>(
        path: String,
        body: B
    ) async throws -> T {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "POST")
            self.applyAuth(&request)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try self.encoder.encode(body)
            return try await self.perform(request)
        }
    }

    // MARK: - POST without response body

    func post<B: Codable & Sendable>(
        path: String,
        body: B
    ) async throws {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "POST")
            self.applyAuth(&request)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try self.encoder.encode(body)
            try await self.performVoid(request)
        }
    }

    // MARK: - PATCH

    func patch<T: Codable & Sendable, B: Codable & Sendable>(
        path: String,
        body: B
    ) async throws -> T {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "PATCH")
            self.applyAuth(&request)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try self.encoder.encode(body)
            return try await self.perform(request)
        }
    }

    // MARK: - DELETE

    func delete(path: String) async throws {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "DELETE")
            self.applyAuth(&request)
            try await self.performVoid(request)
        }
    }

    // MARK: - DELETE with body

    func delete<B: Codable & Sendable>(
        path: String,
        body: B
    ) async throws {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "DELETE")
            self.applyAuth(&request)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try self.encoder.encode(body)
            try await self.performVoid(request)
        }
    }

    // MARK: - Multipart Upload

    func uploadMultipart<T: Codable & Sendable>(
        path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fields: [String: String]? = nil
    ) async throws -> T {
        try await withRetry {
            var request = try self.buildRequest(path: path, method: "POST")
            self.applyAuth(&request)

            let boundary = UUID().uuidString
            request.setValue(
                "multipart/form-data; boundary=\(boundary)",
                forHTTPHeaderField: "Content-Type"
            )

            var body = Data()

            // Add text fields
            if let fields {
                for (key, value) in fields {
                    body.appendString("--\(boundary)\r\n")
                    body.appendString("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
                    body.appendString("\(value)\r\n")
                }
            }

            // Add file data
            body.appendString("--\(boundary)\r\n")
            body.appendString(
                "Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n"
            )
            body.appendString("Content-Type: \(mimeType)\r\n\r\n")
            body.append(fileData)
            body.appendString("\r\n")
            body.appendString("--\(boundary)--\r\n")

            request.httpBody = body
            return try await self.perform(request)
        }
    }

    // MARK: - Private Helpers

    private func withRetry<T: Sendable>(
        maxAttempts: Int = 3,
        operation: () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        for attempt in 0..<maxAttempts {
            do {
                return try await operation()
            } catch let error as APIError {
                switch error {
                case .networkError, .serverError:
                    lastError = error
                    if attempt < maxAttempts - 1 {
                        let delay = min(pow(2.0, Double(attempt)), 8.0)
                        try? await Task.sleep(for: .seconds(delay))
                    }
                default:
                    throw error
                }
            } catch {
                throw error
            }
        }
        throw lastError ?? APIError.networkError(URLError(.unknown))
    }

    private func buildRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        return request
    }

    private func applyAuth(_ request: inout URLRequest) {
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func perform<T: Codable & Sendable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        try validateResponse(data: data, response: response)

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func performVoid(_ request: URLRequest) async throws {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        try validateResponse(data: data, response: response)
    }

    private func validateResponse(data: Data, response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }

        let statusCode = http.statusCode
        guard !(200...299).contains(statusCode) else { return }

        // Try to parse backend error message
        let message = (try? JSONDecoder().decode(BackendErrorResponse.self, from: data))?.message
            ?? "Request failed with status \(statusCode)"

        switch statusCode {
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.badRequest(message)
        default:
            throw APIError.serverError(message)
        }
    }
}
