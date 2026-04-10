import Foundation

// MARK: - Message Type

enum MessageType: String, Codable, Sendable {
    case text
    case system
    case giphy
    case image
}

// MARK: - Message Sender

nonisolated struct MessageSender: Codable, Equatable, Sendable {
    let id: String
    let username: String
    let avatar: String?
}

// MARK: - Message with Sender

nonisolated struct MessageWithSender: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let seq: Int
    let content: String
    let channel: String
    let sender: MessageSender
    let type: MessageType
    let gifUrl: String?
    let imageUrl: String?
    let imageWidth: Int?
    let imageHeight: Int?
    let createdAt: String
    let updatedAt: String
    var reactions: [ReactionSummary]?

    enum CodingKeys: String, CodingKey {
        case id, seq, content, channel, sender, type, reactions
        case gifUrl = "gif_url"
        case imageUrl = "image_url"
        case imageWidth = "image_width"
        case imageHeight = "image_height"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
