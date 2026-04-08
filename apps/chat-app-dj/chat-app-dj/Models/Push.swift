import Foundation

// MARK: - Push Notification Models (APNs / Azure Notification Hub)

nonisolated struct PushSubscribeRequest: Codable, Sendable {
    let deviceToken: String

    enum CodingKeys: String, CodingKey {
        case deviceToken = "device_token"
    }
}

nonisolated struct PushSubscribeResponse: Codable, Sendable {
    let success: Bool
}

nonisolated struct PushUnsubscribeRequest: Codable, Sendable {
    let deviceToken: String

    enum CodingKeys: String, CodingKey {
        case deviceToken = "device_token"
    }
}

nonisolated struct PushUnsubscribeResponse: Codable, Sendable {
    let success: Bool
}
