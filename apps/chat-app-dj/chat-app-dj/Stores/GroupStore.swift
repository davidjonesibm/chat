import SwiftUI

@Observable
@MainActor
final class GroupStore {
    var groups: [ChatGroup] = []
    var loading = false
    var error: String?

    func fetchGroups() async {
        loading = true
        error = nil
        do {
            groups = try await APIClient.shared.get(path: "/groups")
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
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
