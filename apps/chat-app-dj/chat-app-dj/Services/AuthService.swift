import Foundation
import Supabase

actor AuthService {
    static let shared = AuthService()

    private static let tokenKeychainKey = "com.chatapp.accessToken"

    private let client: SupabaseClient

    init() {
        guard let supabaseURL = URL(string: Config.supabaseURL) else {
            fatalError("Invalid Supabase URL: \(Config.supabaseURL)")
        }
        self.client = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: Config.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    // MARK: - Sign Up

    func signUp(email: String, password: String, username: String) async throws -> (User, String) {
        let result = try await client.auth.signUp(
            email: email,
            password: password,
            data: ["username": .string(username)]
        )

        guard let session = result.session else {
            throw AuthError.noSession
        }

        let user = mapUser(from: result.user, accessToken: session.accessToken)
        persistToken(session.accessToken)
        return (user, session.accessToken)
    }

    // MARK: - Sign In

    func signIn(email: String, password: String) async throws -> (User, String) {
        let session = try await client.auth.signIn(email: email, password: password)

        let user = mapUser(from: session.user, accessToken: session.accessToken)
        persistToken(session.accessToken)
        return (user, session.accessToken)
    }

    // MARK: - Sign Out

    func signOut() async throws {
        try await client.auth.signOut(scope: .local)
        clearToken()
    }

    // MARK: - Restore Session

    func restoreSession() async throws -> (User, String)? {
        do {
            let session = try await client.auth.session

            let user = mapUser(from: session.user, accessToken: session.accessToken)
            persistToken(session.accessToken)
            return (user, session.accessToken)
        } catch {
            clearToken()
            return nil
        }
    }

    // MARK: - Auth State Changes

    nonisolated func authStateChanges() -> AsyncStream<(event: AuthChangeEvent, token: String?)> {
        AsyncStream { continuation in
            let task = Task {
                for await (event, session) in client.auth.authStateChanges {
                    continuation.yield((event: event, token: session?.accessToken))
                }
                continuation.finish()
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    // MARK: - Current Token

    nonisolated func currentToken() -> String? {
        KeychainHelper.loadString(key: AuthService.tokenKeychainKey)
    }

    // MARK: - Private Helpers

    private func mapUser(from supabaseUser: Auth.User, accessToken: String) -> User {
        let username = supabaseUser.userMetadata["username"]?.stringValue ?? supabaseUser.email ?? "unknown"

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let createdAt = isoFormatter.string(from: supabaseUser.createdAt)
        let updatedAt = isoFormatter.string(from: supabaseUser.updatedAt)

        return User(
            id: supabaseUser.id.uuidString.lowercased(),
            email: supabaseUser.email ?? "",
            username: username,
            avatar: nil,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    private func persistToken(_ token: String) {
        KeychainHelper.saveString(key: AuthService.tokenKeychainKey, value: token)
    }

    private func clearToken() {
        KeychainHelper.delete(key: AuthService.tokenKeychainKey)
    }
}

// MARK: - Auth Errors

enum AuthError: Error, LocalizedError, Sendable {
    case noSession
    case invalidCredentials

    var errorDescription: String? {
        switch self {
        case .noSession:
            "No session returned — email confirmation may be required"
        case .invalidCredentials:
            "Invalid email or password"
        }
    }
}

// MARK: - AnyJSON String Helper

private extension AnyJSON {
    var stringValue: String? {
        switch self {
        case .string(let value):
            return value
        default:
            return nil
        }
    }
}
