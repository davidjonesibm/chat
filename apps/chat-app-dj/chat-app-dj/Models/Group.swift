import Foundation

// MARK: - ChatGroup

nonisolated struct ChatGroup: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let description: String?
    let owner: String
    let members: [String]?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, owner, members
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Group Requests / Responses

nonisolated struct CreateGroupRequest: Codable, Sendable {
    let name: String
    let description: String?
}

nonisolated struct CreateGroupResponse: Codable, Sendable {
    let group: ChatGroup
    let defaultChannel: ChatChannel
}

nonisolated struct AddMemberRequest: Codable, Sendable {
    let userId: String
}

nonisolated struct GroupMember: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let username: String
    let name: String?
    let avatar: String?
}
