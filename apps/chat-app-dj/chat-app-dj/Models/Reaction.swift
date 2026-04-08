import Foundation

// MARK: - Reaction Summary

nonisolated struct ReactionSummary: Codable, Equatable, Sendable {
    let emoji: String
    let count: Int
    let userIds: [String]
}
