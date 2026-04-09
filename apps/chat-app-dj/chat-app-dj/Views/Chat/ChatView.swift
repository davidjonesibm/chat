import SwiftUI

struct ChatView: View {
    let channelId: String
    let channelName: String

    @Environment(AuthStore.self) private var authStore
    @Environment(ChatStore.self) private var chatStore

    @State private var longPressedMessage: MessageWithSender?
    @State private var showMessageActions = false
    @State private var showGiphyPicker = false
    @State private var pendingGifUrl: String?

    var body: some View {
        VStack(spacing: 0) {
            MessageListView(
                onReact: { messageId, emoji in
                    Task { await chatStore.toggleReaction(messageId: messageId, emoji: emoji) }
                },
                onLongPress: { message in
                    longPressedMessage = message
                    showMessageActions = true
                }
            )

            TypingIndicatorView(typingUsers: chatStore.typingUsers)

            if let gifUrl = pendingGifUrl {
                GifPreviewBar(gifUrl: gifUrl) {
                    pendingGifUrl = nil
                }
            }

            MessageInputBar(
                channelName: channelName,
                onSend: handleSend,
                onStartTyping: { Task { await chatStore.startTyping() } },
                onStopTyping: { Task { await chatStore.stopTyping() } },
                onGifTapped: { showGiphyPicker = true },
                hasPendingAttachment: pendingGifUrl != nil
            )
        }
        .navigationTitle("#\(channelName)")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard let token = authStore.token else { return }
            await chatStore.enterChannel(channelId: channelId, token: token)
        }
        .sheet(isPresented: $showGiphyPicker) {
            GiphyPickerView { gifUrl in
                pendingGifUrl = gifUrl
                showGiphyPicker = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .ignoresSafeArea(edges: .bottom)
        }
        .confirmationDialog(
            "Message",
            isPresented: $showMessageActions,
            presenting: longPressedMessage
        ) { message in
            Button("Copy") {
                UIPasteboard.general.string = message.content
            }
            Button("Reply") {
                // TODO: Implement reply in a future phase
            }
            Button("Cancel", role: .cancel) {}
        }
        .onChange(of: showMessageActions) { _, showing in
            if !showing { longPressedMessage = nil }
        }
    }

    // MARK: - Actions

    private func handleSend(_ text: String) {
        Task {
            await chatStore.stopTyping()
            if let gifUrl = pendingGifUrl {
                await chatStore.sendMessage(content: text, type: .giphy, gifUrl: gifUrl)
                pendingGifUrl = nil
            } else {
                await chatStore.sendMessage(content: text)
            }
        }
    }
}

#Preview {
    NavigationStack {
        ChatView(channelId: "preview-channel", channelName: "general")
    }
    .environment(AuthStore())
    .environment(ChatStore())
}
