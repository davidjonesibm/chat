import Foundation

// MARK: - Cursor-Based Pagination

nonisolated struct CursorPaginatedResponse<T: Codable & Sendable>: Codable, Sendable {
    let items: [T]
    let nextCursor: String?
    let hasMore: Bool
}

// MARK: - Concrete Pagination Types

nonisolated struct CursorPaginatedMessages: Codable, Sendable {
    let items: [MessageWithSender]
    let nextCursor: String?
    let hasMore: Bool
}
