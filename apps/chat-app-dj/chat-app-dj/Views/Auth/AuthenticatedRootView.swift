import SwiftUI

/// The authenticated app shell with group/channel navigation.
struct AuthenticatedRootView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(Router.self) private var router
    @State private var groupStore = GroupStore()
    @State private var channelStore = ChannelStore()
    @State private var chatStore = ChatStore()

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            GroupListView()
                .navigationDestination(for: Router.Destination.self) { destination in
                    switch destination {
                    case .groups:
                        GroupListView()
                    case .group(let groupId):
                        let groupName = groupStore.groups.first(where: { $0.id == groupId })?.name ?? "Group"
                        ChannelListView(groupId: groupId, groupName: groupName)
                    case .channel(let groupId, let channelId):
                        let channelName = channelStore.channels.first(where: { $0.id == channelId })?.name ?? "chat"
                        ChatView(channelId: channelId, channelName: channelName)
                    case .invite(let token):
                        Text("Invite: \(token)")
                    }
                }
        }
        .environment(groupStore)
        .environment(channelStore)
        .environment(chatStore)
        .onChange(of: router.path.count) { oldCount, newCount in
            if newCount < oldCount, chatStore.currentChannelId != nil {
                Task { await chatStore.leaveChannel() }
            }
        }
    }
}
