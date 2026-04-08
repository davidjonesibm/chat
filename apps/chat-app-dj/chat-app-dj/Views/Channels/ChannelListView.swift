import SwiftUI

struct ChannelListView: View {
    let groupId: String
    let groupName: String

    @Environment(ChannelStore.self) private var channelStore
    @Environment(Router.self) private var router

    @State private var showCreateChannel = false

    var body: some View {
        Group {
            if channelStore.loading && channelStore.channels.isEmpty {
                ProgressView("Loading channels…")
            } else if let error = channelStore.error, channelStore.channels.isEmpty {
                ContentUnavailableView {
                    Label("Something went wrong", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await channelStore.fetchChannels(groupId: groupId) }
                    }
                }
            } else if channelStore.channels.isEmpty {
                ContentUnavailableView(
                    "No Channels",
                    systemImage: "number",
                    description: Text("Create a channel to get started.")
                )
            } else {
                List(channelStore.channels) { channel in
                    Button {
                        router.navigate(to: .channel(groupId: groupId, channelId: channel.id))
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("# \(channel.name)")
                                    .font(.body.bold())
                                    .foregroundStyle(.primary)

                                if channel.isDefault {
                                    Text("Default")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(.secondary.opacity(0.15), in: Capsule())
                                }
                            }

                            if let description = channel.description, !description.isEmpty {
                                Text(description)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .tint(.primary)
                }
                .refreshable {
                    await channelStore.fetchChannels(groupId: groupId)
                }
            }
        }
        .navigationTitle(groupName)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Create channel", systemImage: "plus") {
                    showCreateChannel = true
                }
            }
        }
        .sheet(isPresented: $showCreateChannel) {
            CreateChannelSheet(groupId: groupId)
        }
        .task {
            await channelStore.fetchChannels(groupId: groupId)
        }
    }
}
