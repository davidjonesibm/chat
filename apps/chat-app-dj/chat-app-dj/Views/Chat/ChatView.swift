import SwiftUI

/// Identifiable wrapper for URL to use with `.fullScreenCover(item:)`.
private struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct ChatView: View {
    let channelId: String
    let channelName: String

    @Environment(ChatStore.self) private var chatStore

    @State private var longPressedMessage: MessageWithSender?
    @State private var emojiPickerMessageId: String?
    @State private var showGiphyPicker = false
    @State private var pendingGifUrl: String?
    @State private var pendingGifWidth: Int?
    @State private var pendingGifHeight: Int?
    @State private var selectedMediaURL: IdentifiableURL?

    var body: some View {
        MessageListView(
            emojiPickerMessageId: emojiPickerMessageId,
            onReact: { messageId, emoji in
                Task { await chatStore.toggleReaction(messageId: messageId, emoji: emoji) }
            },
            onLongPress: { message in
                longPressedMessage = message
                emojiPickerMessageId = message.id
            },
            onMediaTap: { url in
                selectedMediaURL = IdentifiableURL(url: url)
            }
        )
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
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
        }
        .sheet(isPresented: $showGiphyPicker) {
            GiphyPickerView { gifUrl, width, height in
                pendingGifUrl = gifUrl
                pendingGifWidth = width
                pendingGifHeight = height
                showGiphyPicker = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .ignoresSafeArea(edges: .bottom)
        }
        .overlayPreferenceValue(EmojiPickerAnchorKey.self) { anchor in
            if let anchor, emojiPickerMessageId != nil {
                GeometryReader { proxy in
                    let rect = proxy[anchor]
                    let showAbove = rect.minY > 60
                    let pickerY = showAbove
                        ? rect.minY - 8
                        : rect.maxY + 8

                    // Full-screen dismiss backdrop
                    Color.black.opacity(0.001)
                        .ignoresSafeArea()
                        .onTapGesture { dismissEmojiPicker() }

                    // Emoji picker positioned near the message
                    EmojiPickerView(
                        onSelectEmoji: { emoji in
                            if let messageId = emojiPickerMessageId {
                                Task { await chatStore.toggleReaction(messageId: messageId, emoji: emoji) }
                            }
                            dismissEmojiPicker()
                        },
                        onCopy: {
                            if let message = longPressedMessage {
                                UIPasteboard.general.string = message.content
                            }
                            dismissEmojiPicker()
                        }
                    )
                    .fixedSize()
                    .position(
                        x: proxy.size.width / 2,
                        y: pickerY
                    )
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .animation(.snappy(duration: 0.2), value: emojiPickerMessageId)
        .onChange(of: emojiPickerMessageId) { _, newValue in
            if newValue == nil { longPressedMessage = nil }
        }
        .fullScreenCover(item: $selectedMediaURL) { item in
            ImageViewerOverlay(url: item.url) {
                selectedMediaURL = nil
            }
        }
    }

    // MARK: - Actions

    private func dismissEmojiPicker() {
        emojiPickerMessageId = nil
    }

    private func handleSend(_ text: String) {
        Task {
            await chatStore.stopTyping()
            if let gifUrl = pendingGifUrl {
                await chatStore.sendMessage(content: text, type: .giphy, gifUrl: gifUrl, imageWidth: pendingGifWidth, imageHeight: pendingGifHeight)
                pendingGifUrl = nil
                pendingGifWidth = nil
                pendingGifHeight = nil
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
    .environment(ChatStore())
}
