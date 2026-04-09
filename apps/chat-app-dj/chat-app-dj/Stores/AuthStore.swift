import Foundation
import Observation
import Supabase

@Observable
@MainActor
final class AuthStore {
    var user: User?
    var token: String?
    var loading = false
    var error: String?

    var isAuthenticated: Bool { user != nil && token != nil }

    private var authListenerTask: Task<Void, Never>?

    init() {}

    // MARK: - Restore Session

    /// Call on app launch to restore a previously authenticated session.
    func initAuth() async {
        loading = true
        error = nil
        defer { loading = false }

        do {
            if let (_, accessToken) = try await AuthService.shared.restoreSession() {
                self.token = accessToken
                await APIClient.shared.setToken(accessToken)

                let fullUser: User = try await APIClient.shared.get(path: "/auth/me")
                self.user = fullUser

                startAuthListener()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Register

    func register(email: String, password: String, username: String) async {
        loading = true
        error = nil
        defer { loading = false }

        do {
            let (_, accessToken) = try await AuthService.shared.signUp(
                email: email, password: password, username: username
            )
            self.token = accessToken
            await APIClient.shared.setToken(accessToken)

            let fullUser: User = try await APIClient.shared.get(path: "/auth/me")
            self.user = fullUser

            startAuthListener()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        loading = true
        error = nil
        defer { loading = false }

        do {
            let (_, accessToken) = try await AuthService.shared.signIn(
                email: email, password: password
            )
            self.token = accessToken
            await APIClient.shared.setToken(accessToken)

            let fullUser: User = try await APIClient.shared.get(path: "/auth/me")
            self.user = fullUser

            startAuthListener()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Logout

    func logout() async {
        do {
            try await AuthService.shared.signOut()
        } catch {
            // Log but don't block logout
        }

        authListenerTask?.cancel()
        authListenerTask = nil
        user = nil
        token = nil
        error = nil
        await APIClient.shared.setToken(nil)
    }

    // MARK: - Profile

    func updateProfile(username: String? = nil, name: String? = nil) async throws {
        let request = UpdateProfileRequest(username: username, name: name, avatar: nil)
        let response: UpdateProfileResponse = try await APIClient.shared.patch(
            path: "/auth/profile", body: request
        )
        self.user = response.user
    }

    func uploadAvatar(imageData: Data, fileName: String) async throws {
        let _: AvatarUploadResponse = try await APIClient.shared.uploadMultipart(
            path: "/auth/avatar",
            fileData: imageData,
            fileName: fileName,
            mimeType: "image/jpeg"
        )
        let fullUser: User = try await APIClient.shared.get(path: "/auth/me")
        self.user = fullUser
    }

    func deleteAvatar() async throws {
        try await APIClient.shared.delete(path: "/auth/avatar")
        let fullUser: User = try await APIClient.shared.get(path: "/auth/me")
        self.user = fullUser
    }

    // MARK: - Auth State Listener

    private func startAuthListener() {
        authListenerTask?.cancel()
        authListenerTask = Task {
            for await (event, accessToken) in await AuthService.shared.authStateChanges() {
                guard !Task.isCancelled else { return }

                if let accessToken {
                    self.token = accessToken
                    await APIClient.shared.setToken(accessToken)
                } else if event == .signedOut {
                    self.user = nil
                    self.token = nil
                    await APIClient.shared.setToken(nil)
                }
            }
        }
    }
}
