import SwiftUI
import os

@Observable
@MainActor
final class GroupStore {
    var groups: [ChatGroup] = []
    var loading = false
    var error: String?
    private(set) var hasFetchedOnce = false

    private var lastFetched: Date?
    private let ttl: TimeInterval = 300
    private let logger = Logger(subsystem: "com.chatapp", category: "stores")

    func fetchGroups(force: Bool = false) async {
        logger.info("fetchGroups() called (force: \(force))")

        // TTL check — early return if data is fresh
        if !force,
           !groups.isEmpty,
           let lastFetched,
           Date().timeIntervalSince(lastFetched) < ttl {
            logger.info("fetchGroups() — TTL cache hit, returning early")
            return
        }

        loading = true
        error = nil
        do {
            groups = try await APIClient.shared.get(path: "/groups")
            lastFetched = Date()
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
        hasFetchedOnce = true
        loading = false
    }

    func createGroup(name: String, description: String?) async -> CreateGroupResponse? {
        loading = true
        error = nil
        do {
            let response: CreateGroupResponse = try await APIClient.shared.post(
                path: "/groups",
                body: CreateGroupRequest(name: name, description: description)
            )
            groups.append(response.group)
            loading = false
            return response
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
        return nil
    }
}
