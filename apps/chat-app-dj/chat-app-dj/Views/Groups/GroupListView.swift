import SwiftUI

struct GroupListView: View {
    @Environment(GroupStore.self) private var groupStore
    @Environment(ChannelStore.self) private var channelStore
    @Environment(AuthStore.self) private var authStore
    @Environment(Router.self) private var router
    @State private var showCreateGroup = false
    @State private var loadingGroupId: String?

    var body: some View {
        Group {
            if groupStore.groups.isEmpty && (groupStore.loading || !groupStore.hasFetchedOnce) {
                ProgressView("Loading groups…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = groupStore.error, groupStore.groups.isEmpty {
                ContentUnavailableView {
                    Label("Something went wrong", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await groupStore.fetchGroups() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if groupStore.groups.isEmpty {
                ContentUnavailableView {
                    Label("No groups yet", systemImage: "bubble.left.and.bubble.right")
                } description: {
                    Text("Create a group to start chatting.")
                } actions: {
                    Button("Create a Group") {
                        showCreateGroup = true
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List(groupStore.groups) { group in
                    Button {
                        loadGroup(group)
                    } label: {
                        HStack {
                            GroupRow(group: group)
                            Spacer()
                            if loadingGroupId == group.id {
                                ProgressView()
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .disabled(loadingGroupId != nil)
                }
                .refreshable {
                    await groupStore.fetchGroups(force: true)
                }
            }
        }
        .navigationTitle("Groups")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                profileButton
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Create group", systemImage: "plus") {
                    showCreateGroup = true
                }
            }
        }
        .sheet(isPresented: $showCreateGroup) {
            CreateGroupSheet()
        }
        .task {
            await groupStore.fetchGroups()
        }
    }

    private var profileButton: some View {
        Button {
            // Profile action — future implementation
        } label: {
            UserAvatarView(
                username: authStore.user?.username ?? "",
                avatarUrl: authStore.user?.avatar,
                size: 28
            )
        }
    }

    private func loadGroup(_ group: ChatGroup) {
        guard loadingGroupId == nil else { return }
        loadingGroupId = group.id
        Task {
            await channelStore.fetchChannels(groupId: group.id)
            router.navigate(to: .group(groupId: group.id, groupName: group.name))
            loadingGroupId = nil
        }
    }
}

#Preview {
    NavigationStack {
        GroupListView()
    }
    .environment(GroupStore())
    .environment(ChannelStore())
    .environment(AuthStore())
    .environment(Router())
}
