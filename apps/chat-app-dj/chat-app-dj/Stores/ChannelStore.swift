import SwiftUI
import UIKit
import os

@Observable
@MainActor
final class ChannelStore {
    var channels: [ChatChannel] = []
    var members: [GroupMember] = []
    var loading = false
    var error: String?
    private(set) var currentGroupId: String?
    private(set) var hasAttemptedFetch = false

    private var lastFetched: Date?
    private let ttl: TimeInterval = 300
    private let logger = Logger(subsystem: "com.chatapp", category: "stores")

    func fetchChannels(groupId: String, force: Bool = false) async {
        logger.info("fetchChannels() called for group \(groupId) (force: \(force))")

        // Different group → invalidate and clear
        let groupChanged = groupId != currentGroupId
        if groupChanged {
            logger.info("fetchChannels() — group changed from \(self.currentGroupId ?? "nil") to \(groupId), clearing state")
            channels = []
            members = []
            lastFetched = nil
            hasAttemptedFetch = false
            currentGroupId = groupId
            loading = true

            // Preload member avatars in the background (only on group switch)
            Task {
                await fetchMembers(groupId: groupId)
            }
        }

        // TTL check — early return if fresh
        if !force,
           !channels.isEmpty,
           let lastFetched,
           Date().timeIntervalSince(lastFetched) < ttl {
            logger.info("fetchChannels() — TTL cache hit, returning early")
            return
        }

        logger.info("fetchChannels() — fetching from network")
        loading = true
        error = nil
        do {
            channels = try await APIClient.shared.get(
                path: "/channels",
                queryItems: [URLQueryItem(name: "groupId", value: groupId)]
            )
            lastFetched = Date()
            logger.info("fetchChannels() — fetch complete, \(self.channels.count) channels loaded")
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
        hasAttemptedFetch = true
        loading = false
    }

    func createChannel(name: String, groupId: String, description: String?) async -> ChatChannel? {
        loading = true
        error = nil
        do {
            let channel: ChatChannel = try await APIClient.shared.post(
                path: "/channels",
                body: CreateChannelRequest(name: name, groupId: groupId, description: description)
            )
            channels.append(channel)
            loading = false
            return channel
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
        return nil
    }

    func fetchMembers(groupId: String) async {
        do {
            members = try await APIClient.shared.get(path: "/groups/\(groupId)/members")
            preloadMemberAvatars()
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Avatar Preloading

    private func preloadMemberAvatars() {
        let urls = members.compactMap { member -> URL? in
            guard let avatar = member.avatar, !avatar.isEmpty else { return nil }
            let urlString = avatar.hasPrefix("http") ? avatar : Config.supabaseURL + avatar
            return URL(string: urlString)
        }
        guard !urls.isEmpty else { return }
        Task.detached {
            await ImageCache.shared.preload(urls: urls)
        }
    }
}
