import Foundation
import os

@Observable
@MainActor
final class ChatStore {

    // MARK: - Public Properties

    var messages: [MessageWithSender] = []
    var typingUsers: [String] = []
    var onlineUsers: [String] = []
    var currentChannelId: String?
    var loading = false
    var loadingMore = false
    var error: String?
    var hasMore = true

    // MARK: - Private Properties

    private var nextCursor: String?
    private let webSocketService = WebSocketService()
    private var messageListenerTask: Task<Void, Never>?

    private let logger = Logger(subsystem: "com.chatapp", category: "chat")

    // MARK: - Enter / Leave Channel

    func enterChannel(channelId: String, token: String) async {
        // Leave any existing channel first
        if currentChannelId != nil {
            await leaveChannel()
        }

        currentChannelId = channelId
        loading = true
        error = nil

        logger.info("Entering channel \(channelId)")

        // Run WS connect+join and message fetch concurrently.
        // Messages come from HTTP; live updates come from WS — they're independent.
        async let wsReady: Void = connectAndJoinWebSocket(channelId: channelId, token: token)
        async let messagesFetched: Void = fetchMessages()

        // Await messages first so loading clears as soon as they arrive
        await messagesFetched
        await wsReady
    }

    /// Connects the WebSocket, sends channel:join, and starts listening for live messages.
    private func connectAndJoinWebSocket(channelId: String, token: String) async {
        do {
            try await webSocketService.connect(token: token)
        } catch {
            logger.error("Failed to connect — \(error.localizedDescription)")
            self.error = "Failed to connect to chat."
            return
        }

        do {
            try await webSocketService.send(.channelJoin(.init(channelId: channelId)))
        } catch {
            logger.error("Failed to send channel:join — \(error.localizedDescription)")
        }

        listenForMessages()
    }

    func leaveChannel() async {
        guard let channelId = currentChannelId else { return }

        logger.info("Leaving channel \(channelId)")

        messageListenerTask?.cancel()
        messageListenerTask = nil

        do {
            try await webSocketService.send(.channelLeave(.init(channelId: channelId)))
        } catch {
            logger.error("Failed to send channel:leave — \(error.localizedDescription)")
        }

        await webSocketService.disconnect()

        messages = []
        typingUsers = []
        onlineUsers = []
        currentChannelId = nil
        nextCursor = nil
        hasMore = true
        loading = false
        loadingMore = false
        error = nil
    }

    // MARK: - Send Message

    func sendMessage(
        content: String,
        type: MessageType = .text,
        gifUrl: String? = nil,
        imageUrl: String? = nil
    ) async {
        guard let channelId = currentChannelId else { return }

        do {
            try await webSocketService.send(
                .messageSend(.init(
                    channelId: channelId,
                    content: content,
                    type: type,
                    gifUrl: gifUrl,
                    imageUrl: imageUrl
                ))
            )
        } catch {
            logger.error("Failed to send message — \(error.localizedDescription)")
            self.error = "Failed to send message."
        }
    }

    // MARK: - Fetch Messages (Initial)

    func fetchMessages() async {
        guard let channelId = currentChannelId else { return }

        loading = true
        error = nil

        do {
            let response: CursorPaginatedMessages = try await APIClient.shared.get(
                path: "/channels/\(channelId)/messages",
                queryItems: [URLQueryItem(name: "limit", value: "50")]
            )

            // API returns oldest-first (backend reverses before responding)
            messages = response.items.sorted { $0.seq < $1.seq }
            nextCursor = response.nextCursor
            hasMore = response.hasMore

            logger.info("Fetched \(response.items.count) messages for channel \(channelId)")
        } catch {
            logger.error("Failed to fetch messages — \(error.localizedDescription)")
            self.error = "Failed to load messages."
        }

        loading = false
    }

    // MARK: - Fetch More Messages (Pagination)

    func fetchMoreMessages() async {
        guard let channelId = currentChannelId,
              let cursor = nextCursor,
              hasMore,
              !loadingMore else { return }

        loadingMore = true

        do {
            let response: CursorPaginatedMessages = try await APIClient.shared.get(
                path: "/channels/\(channelId)/messages",
                queryItems: [
                    URLQueryItem(name: "cursor", value: cursor),
                    URLQueryItem(name: "limit", value: "50")
                ]
            )

            // API returns oldest-first; prepend (older messages go to the top)
            let olderMessages = response.items
            let existingIds = Set(messages.map(\.id))
            let deduped = olderMessages.filter { !existingIds.contains($0.id) }
            messages.insert(contentsOf: deduped, at: 0)
            messages.sort { $0.seq < $1.seq }

            nextCursor = response.nextCursor
            hasMore = response.hasMore

            logger.info("Fetched \(response.items.count) more messages for channel \(channelId)")
        } catch {
            logger.error("Failed to fetch more messages — \(error.localizedDescription)")
            self.error = "Failed to load more messages."
            hasMore = false
        }

        loadingMore = false
    }

    // MARK: - Typing Indicators

    func startTyping() async {
        guard let channelId = currentChannelId else { return }
        do {
            try await webSocketService.send(.typingStart(.init(channelId: channelId)))
        } catch {
            logger.error("Failed to send typing:start — \(error.localizedDescription)")
        }
    }

    func stopTyping() async {
        guard let channelId = currentChannelId else { return }
        do {
            try await webSocketService.send(.typingStop(.init(channelId: channelId)))
        } catch {
            logger.error("Failed to send typing:stop — \(error.localizedDescription)")
        }
    }

    // MARK: - Reactions

    func toggleReaction(messageId: String, emoji: String) async {
        do {
            try await webSocketService.send(.reactionToggle(.init(messageId: messageId, emoji: emoji)))
        } catch {
            logger.error("Failed to toggle reaction — \(error.localizedDescription)")
        }
    }

    // MARK: - WebSocket Listener

    private func listenForMessages() {
        messageListenerTask?.cancel()

        messageListenerTask = Task { [weak self] in
            guard let self else { return }

            // Start consuming messages for the current connection
            var messageStreamTask: Task<Void, Never>? = Task { [weak self] in
                await self?.consumeMessages()
            }

            // Observe state changes to handle reconnects
            let states = await webSocketService.stateStream()

            for await connectionState in states {
                if Task.isCancelled { break }

                switch connectionState {
                case .connected:
                    // Reconnected — cancel old stream, rejoin channel, start new stream
                    messageStreamTask?.cancel()

                    if let channelId = self.currentChannelId {
                        do {
                            try await self.webSocketService.send(.channelJoin(.init(channelId: channelId)))
                        } catch {
                            self.logger.error("Failed to rejoin channel — \(error.localizedDescription)")
                        }
                    }

                    messageStreamTask = Task { [weak self] in
                        await self?.consumeMessages()
                    }

                default:
                    messageStreamTask?.cancel()
                    messageStreamTask = nil
                }
            }

            messageStreamTask?.cancel()
        }
    }

    private func consumeMessages() async {
        let stream = await webSocketService.messages()
        do {
            for try await serverMessage in stream {
                if Task.isCancelled { break }
                handleServerMessage(serverMessage)
            }
        } catch {
            if !Task.isCancelled {
                logger.error("Message stream error: \(error.localizedDescription)")
            }
        }
    }

    private func handleServerMessage(_ message: ServerMessage) {
        switch message {
        case .messageNew(let payload):
            guard payload.message.channel == currentChannelId else { return }
            // Avoid duplicates
            let isDuplicate = messages.contains { $0.id == payload.message.id }
            if !isDuplicate {
                messages.append(payload.message)
                messages.sort { $0.seq < $1.seq }
                logger.debug("New message \(payload.message.id) appended.")
            }

        case .typingUpdate(let payload):
            guard payload.channelId == currentChannelId else { return }
            typingUsers = payload.users

        case .presenceUpdate(let payload):
            guard payload.channelId == currentChannelId else { return }
            onlineUsers = payload.users

        case .reactionUpdated(let payload):
            if let index = messages.firstIndex(where: { $0.id == payload.messageId }) {
                messages[index].reactions = payload.reactions
            }

        case .channelUpdated:
            // Ignored for now (Phase 3 scope)
            break

        case .error(let payload):
            logger.error("Server error [\(payload.code)]: \(payload.message)")
        }
    }
}
