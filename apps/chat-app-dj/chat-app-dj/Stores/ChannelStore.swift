import SwiftUI

@Observable
@MainActor
final class ChannelStore {
    var channels: [ChatChannel] = []
    var members: [GroupMember] = []
    var loading = false
    var error: String?

    func fetchChannels(groupId: String) async {
        loading = true
        error = nil
        do {
            channels = try await APIClient.shared.get(
                path: "/channels",
                queryItems: [URLQueryItem(name: "groupId", value: groupId)]
            )
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
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
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}
