import Foundation

// MARK: - Client → Server

enum ClientMessage: Codable, Sendable {
    case messageSend(MessageSendPayload)
    case typingStart(TypingPayload)
    case typingStop(TypingPayload)
    case channelJoin(ChannelPayload)
    case channelLeave(ChannelPayload)
    case reactionToggle(ReactionTogglePayload)

    struct MessageSendPayload: Codable, Sendable {
        let channelId: String
        let content: String
        let type: MessageType?
        let gifUrl: String?
        let imageUrl: String?

        enum CodingKeys: String, CodingKey {
            case channelId, content, type
            case gifUrl = "gif_url"
            case imageUrl = "image_url"
        }
    }

    struct TypingPayload: Codable, Sendable {
        let channelId: String
    }

    struct ChannelPayload: Codable, Sendable {
        let channelId: String
    }

    struct ReactionTogglePayload: Codable, Sendable {
        let messageId: String
        let emoji: String
    }
}

// MARK: - ClientMessage Codable

extension ClientMessage {
    private enum CodingKeys: String, CodingKey {
        case type, payload
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .messageSend(let payload):
            try container.encode("message:send", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .typingStart(let payload):
            try container.encode("typing:start", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .typingStop(let payload):
            try container.encode("typing:stop", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .channelJoin(let payload):
            try container.encode("channel:join", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .channelLeave(let payload):
            try container.encode("channel:leave", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .reactionToggle(let payload):
            try container.encode("reaction:toggle", forKey: .type)
            try container.encode(payload, forKey: .payload)
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "message:send":
            self = .messageSend(try container.decode(MessageSendPayload.self, forKey: .payload))
        case "typing:start":
            self = .typingStart(try container.decode(TypingPayload.self, forKey: .payload))
        case "typing:stop":
            self = .typingStop(try container.decode(TypingPayload.self, forKey: .payload))
        case "channel:join":
            self = .channelJoin(try container.decode(ChannelPayload.self, forKey: .payload))
        case "channel:leave":
            self = .channelLeave(try container.decode(ChannelPayload.self, forKey: .payload))
        case "reaction:toggle":
            self = .reactionToggle(try container.decode(ReactionTogglePayload.self, forKey: .payload))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: [CodingKeys.type], debugDescription: "Unknown client message type: \(type)")
            )
        }
    }
}

// MARK: - Server → Client

enum ServerMessage: Codable, Sendable {
    case messageNew(MessageNewPayload)
    case typingUpdate(TypingUpdatePayload)
    case presenceUpdate(PresenceUpdatePayload)
    case channelUpdated(ChannelUpdatedPayload)
    case reactionUpdated(ReactionUpdatedPayload)
    case error(ErrorPayload)

    struct MessageNewPayload: Codable, Sendable {
        let message: MessageWithSender
    }

    struct TypingUpdatePayload: Codable, Sendable {
        let channelId: String
        let users: [String]
    }

    struct PresenceUpdatePayload: Codable, Sendable {
        let channelId: String
        let users: [String]
    }

    struct ChannelUpdatedPayload: Codable, Sendable {
        let channelId: String
        let name: String?
        let description: String?
    }

    struct ReactionUpdatedPayload: Codable, Sendable {
        let messageId: String
        let reactions: [ReactionSummary]
    }

    struct ErrorPayload: Codable, Sendable {
        let code: String
        let message: String
    }
}

// MARK: - ServerMessage Codable

extension ServerMessage {
    private enum CodingKeys: String, CodingKey {
        case type, payload
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "message:new":
            self = .messageNew(try container.decode(MessageNewPayload.self, forKey: .payload))
        case "typing:update":
            self = .typingUpdate(try container.decode(TypingUpdatePayload.self, forKey: .payload))
        case "presence:update":
            self = .presenceUpdate(try container.decode(PresenceUpdatePayload.self, forKey: .payload))
        case "channel:updated":
            self = .channelUpdated(try container.decode(ChannelUpdatedPayload.self, forKey: .payload))
        case "reaction:updated":
            self = .reactionUpdated(try container.decode(ReactionUpdatedPayload.self, forKey: .payload))
        case "error":
            self = .error(try container.decode(ErrorPayload.self, forKey: .payload))
        default:
            throw DecodingError.dataCorrupted(
                .init(codingPath: [CodingKeys.type], debugDescription: "Unknown server message type: \(type)")
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .messageNew(let payload):
            try container.encode("message:new", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .typingUpdate(let payload):
            try container.encode("typing:update", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .presenceUpdate(let payload):
            try container.encode("presence:update", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .channelUpdated(let payload):
            try container.encode("channel:updated", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .reactionUpdated(let payload):
            try container.encode("reaction:updated", forKey: .type)
            try container.encode(payload, forKey: .payload)
        case .error(let payload):
            try container.encode("error", forKey: .type)
            try container.encode(payload, forKey: .payload)
        }
    }
}
