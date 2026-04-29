import SwiftUI
import os

/// Combined container: channel drawer + chat view for a single group.
/// Replaces the old ChannelListView → ChatView two-step navigation.
struct GroupChatView: View {
    let groupId: String
    let groupName: String

    @Environment(AuthStore.self) private var authStore
    @Environment(ChannelStore.self) private var channelStore
    @Environment(ChatStore.self) private var chatStore
    @Environment(Router.self) private var router

    @State private var selectedChannelId: String?
    @State private var isDrawerOpen = false
    @State private var showCreateChannel = false

    private let drawerWidth: CGFloat = 280
    private let logger = Logger(subsystem: "com.chatapp", category: "navigation")

    private var selectedChannelName: String? {
        guard let id = selectedChannelId else { return nil }
        return channelStore.channels.first(where: { $0.id == id })?.name
    }

    var body: some View {
        ZStack(alignment: .leading) {
            // Main chat content
            mainContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Dimmed backdrop
            Color.black.opacity(isDrawerOpen ? 0.4 : 0)
                .ignoresSafeArea(.container)
                .onTapGesture { closeDrawer() }
                .allowsHitTesting(isDrawerOpen)

            // Channel drawer
            ChannelDrawerView(
                groupId: groupId,
                groupName: groupName,
                selectedChannelId: selectedChannelId,
                onSelectChannel: { channelId in
                    selectChannel(channelId)
                    closeDrawer()
                },
                onCreateChannel: {
                    closeDrawer()
                    showCreateChannel = true
                },
                onBack: {
                    router.pop()
                }
            )
            .frame(width: drawerWidth)
            .offset(x: isDrawerOpen ? 0 : -drawerWidth)

            // Edge swipe hit area (only when drawer is closed)
            if !isDrawerOpen {
                edgeSwipeArea
            }
        }
        .navigationTitle(selectedChannelName.map { "#\($0)" } ?? groupName)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Channels", systemImage: "sidebar.leading") {
                    toggleDrawer()
                }
            }
        }
        .task {
            logger.info("GroupChatView.task fired for group \(self.groupId)")
            await channelStore.fetchChannels(groupId: groupId)
            autoSelectChannel()
        }
        .onChange(of: channelStore.channels) { _, _ in
            if selectedChannelId == nil {
                autoSelectChannel()
            }
        }
        .task(id: selectedChannelId) {
            guard let channelId = selectedChannelId, let token = authStore.token else { return }
            logger.info("Channel selected: \(channelId)")
            await chatStore.enterChannel(channelId: channelId, token: token)
        }
        .sheet(isPresented: $showCreateChannel) {
            CreateChannelSheet(groupId: groupId)
        }
    }

    // MARK: - Main Content

    @ViewBuilder
    private var mainContent: some View {
        if let channelId = selectedChannelId,
           let channel = channelStore.channels.first(where: { $0.id == channelId }) {
            ChatView(channelId: channelId, channelName: channel.name)
        } else if channelStore.loading {
            ProgressView("Loading channels…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if channelStore.channels.isEmpty, channelStore.hasAttemptedFetch {
            ContentUnavailableView(
                "No Channels",
                systemImage: "number",
                description: Text("Open the sidebar to create a channel.")
            )
        } else {
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - Edge Swipe Area

    private var edgeSwipeArea: some View {
        HStack {
            Color.clear
                .frame(width: 24)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 20)
                        .onEnded { value in
                            if value.translation.width > 60 {
                                openDrawer()
                            }
                        }
                )
            Spacer()
        }
    }

    // MARK: - Drawer Actions

    private func openDrawer() {
        withAnimation(.easeOut(duration: 0.25)) {
            isDrawerOpen = true
        }
    }

    private func closeDrawer() {
        withAnimation(.easeOut(duration: 0.25)) {
            isDrawerOpen = false
        }
    }

    private func toggleDrawer() {
        withAnimation(.easeOut(duration: 0.25)) {
            isDrawerOpen.toggle()
        }
    }

    // MARK: - Channel Selection

    private func selectChannel(_ channelId: String) {
        selectedChannelId = channelId
    }

    private func autoSelectChannel() {
        guard selectedChannelId == nil, !channelStore.channels.isEmpty else { return }
        let channel = channelStore.channels.first(where: { $0.isDefault })
            ?? channelStore.channels.first
        if let channel {
            logger.info("Auto-selecting channel: \(channel.name) (\(channel.id))")
            selectedChannelId = channel.id
        }
    }
}
