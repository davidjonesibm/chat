import Foundation
import os

// MARK: - SocketStream (Donny Wals pattern)

/// A struct-based `AsyncSequence` wrapper around `URLSessionWebSocketTask` that allows
/// iterating over incoming WebSocket messages using `for try await`.
/// Each iterator calls `task.receive()` directly, eliminating shared mutable state.
struct SocketStream: AsyncSequence, Sendable {
    typealias Element = URLSessionWebSocketTask.Message

    private let task: URLSessionWebSocketTask

    init(task: URLSessionWebSocketTask) {
        self.task = task
    }

    func makeAsyncIterator() -> AsyncIterator {
        AsyncIterator(task: task)
    }

    func cancel() {
        task.cancel(with: .goingAway, reason: nil)
    }

    struct AsyncIterator: AsyncIteratorProtocol {
        let task: URLSessionWebSocketTask

        mutating func next() async throws -> Element? {
            guard task.closeCode == .invalid else { return nil }
            return try await task.receive()
        }
    }
}

// MARK: - WebSocketService

actor WebSocketService {

    enum ConnectionState: Sendable {
        case disconnected
        case connecting
        case connected
        case reconnecting
    }

    // MARK: - Properties

    private(set) var state: ConnectionState = .disconnected

    private var socketStream: SocketStream?
    private var webSocketTask: URLSessionWebSocketTask?
    private var currentToken: String?
    private var reconnectAttempts: Int = 0
    private var reconnectTask: Task<Void, Never>?
    private var stateContinuations: [UUID: AsyncStream<ConnectionState>.Continuation] = [:]

    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.chatapp", category: "websocket")

    private let maxReconnectAttempts = 10
    private let maxReconnectDelay: TimeInterval = 30

    // MARK: - Init

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - State Broadcasting

    /// Returns an `AsyncStream` that yields future connection state changes (does not yield the current state).
    func stateStream() -> AsyncStream<ConnectionState> {
        AsyncStream { continuation in
            let id = UUID()
            stateContinuations[id] = continuation
            continuation.onTermination = { @Sendable [weak self] _ in
                Task { [weak self] in
                    await self?.removeStateContinuation(id: id)
                }
            }
        }
    }

    private func removeStateContinuation(id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }

    private func setState(_ newState: ConnectionState) {
        state = newState
        for (_, continuation) in stateContinuations {
            continuation.yield(newState)
        }
    }

    // MARK: - Connect

    func connect(token: String) async throws {
        guard state == .disconnected || state == .reconnecting else {
            logger.debug("Connect called while already \(String(describing: self.state)); ignoring.")
            return
        }

        currentToken = token
        setState(.connecting)
        logger.info("Connecting to WebSocket…")

        guard var components = URLComponents(string: Config.wsURL) else {
            logger.error("Invalid WebSocket URL: \(Config.wsURL)")
            setState(.disconnected)
            return
        }

        components.queryItems = [URLQueryItem(name: "token", value: token)]

        guard let url = components.url else {
            logger.error("Could not build WebSocket URL with token query param.")
            setState(.disconnected)
            return
        }

        let task = session.webSocketTask(with: url)
        webSocketTask = task
        task.resume()

        // Verify the handshake by sending a ping and awaiting the pong
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                task.sendPing { error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume()
                    }
                }
            }
        } catch {
            logger.error("WebSocket handshake failed: \(error.localizedDescription)")
            task.cancel(with: .goingAway, reason: nil)
            webSocketTask = nil
            setState(.disconnected)
            throw error
        }

        socketStream = SocketStream(task: task)
        setState(.connected)
        reconnectAttempts = 0
        logger.info("WebSocket connected.")
    }

    // MARK: - Disconnect

    func disconnect() {
        logger.info("Disconnecting WebSocket.")
        reconnectTask?.cancel()
        reconnectTask = nil
        socketStream?.cancel()
        socketStream = nil
        webSocketTask = nil
        currentToken = nil
        reconnectAttempts = 0
        setState(.disconnected)
    }

    // MARK: - Send

    func send(_ message: ClientMessage) async throws {
        guard state == .connected else {
            logger.warning("Cannot send — WebSocket not connected (state: \(String(describing: self.state))).")
            return
        }

        guard let webSocketTask else {
            logger.warning("Cannot send message — no active WebSocket task.")
            return
        }

        let data = try encoder.encode(message)

        guard let jsonString = String(data: data, encoding: .utf8) else {
            logger.error("Failed to encode ClientMessage to UTF-8 string.")
            return
        }

        logger.debug("Sending: \(jsonString)")
        try await webSocketTask.send(.string(jsonString))
    }

    // MARK: - Messages

    /// Returns an `AsyncThrowingStream` of decoded `ServerMessage` values.
    /// Iterates over the underlying `SocketStream`, decodes `.string` frames,
    /// and triggers reconnection when the stream ends unexpectedly.
    func messages() -> AsyncThrowingStream<ServerMessage, Error> {
        let capturedStream = self.socketStream
        return AsyncThrowingStream { continuation in
            let iterateTask = Task { [weak self] in
                guard let self else {
                    continuation.finish()
                    return
                }

                guard let stream = capturedStream else {
                    continuation.finish()
                    return
                }

                do {
                    for try await wsMessage in stream {
                        if Task.isCancelled { break }

                        switch wsMessage {
                        case .string(let text):
                            guard let data = text.data(using: .utf8) else { continue }
                            do {
                                let decoded = try await self.decodeServerMessage(data)
                                continuation.yield(decoded)
                            } catch {
                                await self.logger.warning("Failed to decode ServerMessage: \(error.localizedDescription)")
                            }
                        case .data(let data):
                            do {
                                let decoded = try await self.decodeServerMessage(data)
                                continuation.yield(decoded)
                            } catch {
                                await self.logger.warning("Failed to decode ServerMessage from data frame: \(error.localizedDescription)")
                            }
                        @unknown default:
                            await self.logger.debug("Unknown WebSocket message type received.")
                        }
                    }

                    // Stream ended — trigger reconnect only if we were still connected
                    let currentState = await self.state
                    if currentState == .connected {
                        await self.logger.info("WebSocket stream ended. Attempting reconnect…")
                        await self.scheduleReconnect()
                    }
                    continuation.finish()
                } catch {
                    let currentState = await self.state
                    if currentState == .connected {
                        await self.logger.error("WebSocket stream error: \(error.localizedDescription). Attempting reconnect…")
                        await self.scheduleReconnect()
                    }
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { _ in
                iterateTask.cancel()
            }
        }
    }

    // MARK: - Private Helpers

    private func decodeServerMessage(_ data: Data) throws -> ServerMessage {
        return try decoder.decode(ServerMessage.self, from: data)
    }

    private func scheduleReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            logger.error("Max reconnect attempts (\(self.maxReconnectAttempts)) reached. Giving up.")
            setState(.disconnected)
            return
        }

        guard let token = currentToken else {
            logger.error("No token available for reconnect.")
            setState(.disconnected)
            return
        }

        setState(.reconnecting)
        reconnectAttempts += 1

        let delay = min(pow(2.0, Double(reconnectAttempts - 1)), maxReconnectDelay)
        logger.info("Reconnect attempt \(self.reconnectAttempts)/\(self.maxReconnectAttempts) in \(delay)s…")

        // Clean up old connection
        socketStream?.cancel()
        socketStream = nil
        webSocketTask = nil

        reconnectTask?.cancel()
        reconnectTask = Task { [weak self, token, delay] in
            do {
                try await Task.sleep(for: .seconds(delay))
            } catch {
                return // Task cancelled
            }

            guard let self, !Task.isCancelled else { return }
            do {
                try await self.connect(token: token)
            } catch {
                await self.logger.error("Reconnect failed: \(error.localizedDescription)")
                await self.scheduleReconnect()
            }
        }
    }
}
