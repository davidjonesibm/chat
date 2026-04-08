import Foundation

// MARK: - Group Invite

nonisolated struct GroupInvite: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let token: String
    let groupId: String
    let createdBy: String
    let expiresAt: String?
    let maxUses: Int?
    let useCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, token
        case groupId = "group_id"
        case createdBy = "created_by"
        case expiresAt = "expires_at"
        case maxUses = "max_uses"
        case useCount = "use_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Invite Requests / Responses

nonisolated struct CreateInviteRequest: Codable, Sendable {
    let groupId: String
    let expiresInHours: Int?
    let maxUses: Int?
}

nonisolated struct CreateInviteResponse: Codable, Sendable {
    let invite: GroupInvite
}

nonisolated struct InviteInfoResponse: Codable, Equatable, Sendable {
    let groupId: String
    let groupName: String
    let groupDescription: String?
    let memberCount: Int
    let inviterName: String
    let expiresAt: String?
    let alreadyMember: Bool
}

nonisolated struct JoinViaInviteResponse: Codable, Sendable {
    let group: ChatGroup
    let defaultChannel: ChatChannel
}
