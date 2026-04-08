import Foundation
import os

// MARK: - SocketStream (Donny Wals pattern)

/// An `AsyncSequence` wrapper around `URLSessionWebSocketTask` that allows
/// iterating over incoming WebSocket messages using `for try await`.
/// Pattern from: https://www.donnywals.com/iterating-over-web-socket-messages-with-async-await-in-swift/
final class SocketStream: AsyncSequence, @unchecked Sendable {
    typealias WebSocketStream = AsyncThrowingStream<URLSessionWebSocketTask.Message, Error>
    typealias AsyncIterator = WebSocketStream.Iterator
    typealias Element = URLSessionWebSocketTask.Message

    private var continuation: WebSocketStream.Continuation?
    private let task: URLSessionWebSocketTask

    private lazy var stream: WebSocketStream = {
        return WebSocketStream { continuation in
            self.continuation = continuation

            Task {
                var isAlive = true

                while isAlive && task.closeCode == .invalid {
                    do {
                        let value = try await task.receive()
                        continuation.yield(value)
                    } catch {
                        continuation.finish(throwing: error)
                        isAlive = false
                    }
                }
            }
        }
    }()

    init(task: URLSessionWebSocketTask) {
        self.task = task
        task.resume()
    }

    deinit {
        continuation?.finish()
    }

    func makeAsyncIterator() -> AsyncIterator {
        return stream.makeAsyncIterator()
    }

    func cancel() {
        task.cancel(with: .goingAway, reason: nil)
        continuation?.finish()
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

    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.chatapp", category: "websocket")

    private let maxReconnectAttempts = 10
    private let maxReconnectDelay: TimeInterval = 30

    // MARK: - Init

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Connect

    func connect(token: String) {
        guard state == .disconnected || state == .reconnecting else {
            logger.debug("Connect called while already \(String(describing: self.state)); ignoring.")
            return
        }

        currentToken = token
        state = .connecting
        logger.info("Connecting to WebSocket…")

        guard var components = URLComponents(string: Config.wsURL) else {
            logger.error("Invalid WebSocket URL: \(Config.wsURL)")
            state = .disconnected
            return
        }

        components.queryItems = [URLQueryItem(name: "token", value: token)]

        guard let url = components.url else {
            logger.error("Could not build WebSocket URL with token query param.")
            state = .disconnected
            return
        }

        let task = session.webSocketTask(with: url)
        webSocketTask = task
        socketStream = SocketStream(task: task)

        state = .connected
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
        state = .disconnected
    }

    // MARK: - Send

    func send(_ message: ClientMessage) async throws {
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
        return AsyncThrowingStream { continuation in
            let iterateTask = Task { [weak self] in
                guard let self else {
                    continuation.finish()
                    return
                }

                guard let stream = await self.socketStream else {
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

                    // Stream ended — attempt reconnect if we didn't disconnect intentionally
                    let currentState = await self.state
                    if currentState != .disconnected {
                        await self.logger.info("WebSocket stream ended. Attempting reconnect…")
                        await self.scheduleReconnect()
                    }
                    continuation.finish()
                } catch {
                    let currentState = await self.state
                    if currentState != .disconnected {
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
            state = .disconnected
            return
        }

        guard let token = currentToken else {
            logger.error("No token available for reconnect.")
            state = .disconnected
            return
        }

        state = .reconnecting
        reconnectAttempts += 1

        let delay = min(pow(2.0, Double(reconnectAttempts - 1)), maxReconnectDelay)
        logger.info("Reconnect attempt \(self.reconnectAttempts)/\(self.maxReconnectAttempts) in \(delay)s…")

        // Clean up old connection
        socketStream?.cancel()
        socketStream = nil
        webSocketTask = nil

        reconnectTask = Task { [weak self, token, delay] in
            do {
                try await Task.sleep(for: .seconds(delay))
            } catch {
                return // Task cancelled
            }

            guard let self, !Task.isCancelled else { return }
            await self.connect(token: token)
        }
    }
}
