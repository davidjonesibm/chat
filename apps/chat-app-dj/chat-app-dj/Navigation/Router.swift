import SwiftUI
import Observation

@Observable
@MainActor
final class Router {
    var path = NavigationPath()

    // MARK: - Destinations

    enum Destination: Hashable {
        case groups
        case group(groupId: String)
        case channel(groupId: String, channelId: String)
        case invite(token: String)
    }

    // MARK: - Navigation

    func navigate(to destination: Destination) {
        path.append(destination)
    }

    func popToRoot() {
        path = NavigationPath()
    }

    func pop() {
        if !path.isEmpty {
            path.removeLast()
        }
    }
}
