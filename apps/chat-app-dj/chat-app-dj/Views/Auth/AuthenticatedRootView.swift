import SwiftUI
import os

/// The authenticated app shell with group/channel navigation.
struct AuthenticatedRootView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(Router.self) private var router
    @State private var groupStore = GroupStore()
    @State private var channelStore = ChannelStore()
    @State private var chatStore = ChatStore()

    private let logger = Logger(subsystem: "com.chatapp", category: "navigation")

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            GroupListView()
                .navigationDestination(for: Router.Destination.self) { destination in
                    switch destination {
                    case .groups:
                        let _ = logger.info("Resolving .groups destination")
                        GroupListView()
                    case .group(let groupId, let groupName):
                        let _ = logger.info("Resolving .group(\(groupId)) destination")
                        GroupChatView(groupId: groupId, groupName: groupName)
                    case .channel(let groupId, let channelId):
                        let _ = logger.info("Resolving .channel(group: \(groupId), channel: \(channelId)) destination")
                        let channelName = channelStore.channels.first(where: { $0.id == channelId })?.name ?? "chat"
                        ChatView(channelId: channelId, channelName: channelName)
                    case .invite(let token):
                        let _ = logger.info("Resolving .invite(\(token)) destination")
                        Text("Invite: \(token)")
                    }
                }
        }
        .environment(groupStore)
        .environment(channelStore)
        .environment(chatStore)
        .task {
            try? await Task.sleep(for: .milliseconds(500))
            KeyboardWarmer.warmUp()
        }
        .onChange(of: router.path.count) { oldCount, newCount in
            if newCount < oldCount, chatStore.currentChannelId != nil {
                Task { await chatStore.leaveChannel() }
            }
        }
    }
}
