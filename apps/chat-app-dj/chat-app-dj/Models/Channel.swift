import Foundation

// MARK: - Channel

nonisolated struct ChatChannel: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let group: String
    let description: String?
    let isDefault: Bool
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, group, description
        case isDefault = "is_default"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Channel Requests

nonisolated struct CreateChannelRequest: Codable, Sendable {
    let name: String
    let groupId: String
    let description: String?
}
