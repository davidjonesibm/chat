import SwiftUI

struct GroupListView: View {
    @Environment(GroupStore.self) private var groupStore
    @Environment(AuthStore.self) private var authStore
    @Environment(Router.self) private var router
    @State private var showCreateGroup = false

    var body: some View {
        Group {
            if groupStore.loading && groupStore.groups.isEmpty {
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
                        router.navigate(to: .group(groupId: group.id))
                    } label: {
                        GroupRow(group: group)
                    }
                }
                .refreshable {
                    await groupStore.fetchGroups()
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
            if let avatar = authStore.user?.avatar, let url = URL(string: avatar) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Image(systemName: "person.circle")
                }
                .frame(width: 28, height: 28)
                .clipShape(Circle())
            } else {
                Image(systemName: "person.circle")
                    .imageScale(.large)
            }
        }
    }
}

#Preview {
    NavigationStack {
        GroupListView()
    }
    .environment(GroupStore())
    .environment(AuthStore())
    .environment(Router())
}
