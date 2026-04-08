import Foundation

// MARK: - User

nonisolated struct User: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let email: String
    let username: String
    var avatar: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, email, username, avatar
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Auth Requests / Responses

nonisolated struct RegisterRequest: Codable, Sendable {
    let email: String
    let password: String
    let username: String
}

nonisolated struct LoginRequest: Codable, Sendable {
    let email: String
    let password: String
}

nonisolated struct AuthResponse: Codable, Sendable {
    let user: User
    let token: String
}

nonisolated struct UpdateProfileRequest: Codable, Sendable {
    let username: String?
    let name: String?
    let avatar: String?
}

nonisolated struct UpdateProfileResponse: Codable, Sendable {
    let user: User
}

nonisolated struct AvatarUploadResponse: Codable, Sendable {
    let url: String
}
