import SwiftUI
import os

private let logger = Logger(subsystem: "com.chatapp", category: "MessageList")

// MARK: - Message Metadata

/// Pre-computed display metadata for a message in the list.
private struct MessageMetadata: Identifiable {
    let message: MessageWithSender
    let isNewSender: Bool
    let dateLabel: String?  // non-nil when a date separator should appear above this message

    var id: String { message.id }
}

// MARK: - Message List View

/// Scrollable message list with sender grouping, date separators, infinite scroll,
/// auto-scroll-to-bottom, and an unread count banner — mirroring the Vue `MessageList.vue`.
struct MessageListView: View {

    // MARK: - Environment

    @Environment(ChatStore.self) private var chatStore

    // MARK: - Callbacks

    let emojiPickerMessageId: String?
    let onReact: (String, String) -> Void        // (messageId, emoji)
    let onLongPress: (MessageWithSender) -> Void
    let onMediaTap: (URL) -> Void

    // MARK: - Local State

    @State private var unreadCount = 0
    @State private var isNearBottom = true
    @State private var scrollTarget: String?
    @State private var shouldAnimateScroll = false
    @State private var oldestMessageIdBeforeLoad: String?
    @State private var paginationCooldown = false

    // MARK: - Constants

    private static let groupingInterval: TimeInterval = 5 * 60  // 5 minutes
    private static let bottomAnchorId = "bottom-anchor"

    /// Computed synchronously so metadata is available in the same render frame as messages,
    /// ensuring `.defaultScrollAnchor(.bottom)` fires against a populated ScrollView.
    private var metadata: [MessageMetadata] {
        Self.computeMetadata(from: chatStore.messages)
    }

    // MARK: - Metadata Computation

    /// Computes sender grouping and date separator metadata for each message,
    /// matching the Vue `messageMetadata` logic.
    private static func computeMetadata(from messages: [MessageWithSender]) -> [MessageMetadata] {
        var result: [MessageMetadata] = []
        result.reserveCapacity(messages.count)

        var previousSenderId: String?
        var previousDate: Date?
        var previousDateLabel: String?

        for message in messages {
            // --- Date separator ---
            let currentDate = DateFormatting.parseDate(message.createdAt)
            let currentLabel = DateFormatting.formatDateLabel(message.createdAt)

            var dateLabel: String?
            if !currentLabel.isEmpty, currentLabel != previousDateLabel {
                dateLabel = currentLabel
            }
            previousDateLabel = currentLabel.isEmpty ? previousDateLabel : currentLabel

            // --- Sender grouping ---
            let isNewSender: Bool

            if message.type == .system {
                // System messages always break the group
                isNewSender = false
                previousSenderId = nil
                previousDate = nil
            } else if message.sender.id != previousSenderId {
                isNewSender = true
            } else if let prev = previousDate, let curr = currentDate,
                      curr.timeIntervalSince(prev) > groupingInterval {
                // Same sender but > 5 minutes gap
                isNewSender = true
            } else {
                isNewSender = false
            }

            // Track previous for next iteration (only for non-system messages)
            if message.type != .system {
                previousSenderId = message.sender.id
                previousDate = currentDate
            }

            result.append(MessageMetadata(
                message: message,
                isNewSender: isNewSender,
                dateLabel: dateLabel
            ))
        }

        return result
    }

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .bottom) {
            if chatStore.messages.isEmpty {
                emptyOrLoadingOverlay
            } else {
                messageScrollView
            }
            if unreadCount > 0 {
                unreadBanner
            }
        }
        .onChange(of: chatStore.messages.last?.id) { oldValue, newValue in
            handleNewMessage(oldLastId: oldValue, newLastId: newValue)
        }
    }

    // MARK: - Scroll View

    private var messageScrollView: some View {
        ScrollViewReader { proxy in
            scrollContent
                .scrollNearBottomTracking($isNearBottom)
                .onChange(of: scrollTarget) { _, target in
                    guard let target else { return }
                    if shouldAnimateScroll {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo(target, anchor: .bottom)
                        }
                    } else {
                        proxy.scrollTo(target, anchor: .bottom)
                    }
                    scrollTarget = nil
                    shouldAnimateScroll = false
                }
                .onChange(of: chatStore.loadingMore) { oldValue, newValue in
                    // When loading finishes, preserve scroll position by scrolling to
                    // the message that was previously at the top
                    if oldValue == true, newValue == false,
                       let anchorId = oldestMessageIdBeforeLoad {
                        proxy.scrollTo(anchorId, anchor: .top)
                        oldestMessageIdBeforeLoad = nil
                    }
                }
        }
    }

    private var scrollContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Top sentinel for infinite scroll
                topSentinel

                // Message rows with date separators
                ForEach(metadata) { item in
                    VStack(spacing: 0) {
                        if let dateLabel = item.dateLabel {
                            dateSeparator(label: dateLabel)
                        }
                        MessageRow(
                            message: item.message,
                            isNewSender: item.isNewSender,
                            emojiPickerMessageId: emojiPickerMessageId,
                            onReact: onReact,
                            onLongPress: onLongPress,
                            onMediaTap: onMediaTap
                        )
                    }
                    .id(item.message.id)
                }

                // Bottom anchor for scroll-to-bottom
                Color.clear
                    .frame(height: 1)
                    .id(Self.bottomAnchorId)
            }
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Top Sentinel (Infinite Scroll)

    /// Stable-identity sentinel: always the same `Color.clear` view so `.task`
    /// fires only when the view scrolls into the viewport — not when loading state changes.
    /// Using `.task` instead of `.onAppear` ensures auto-cancellation on disappear.
    private var topSentinel: some View {
        Color.clear
            .frame(height: 1)
            .overlay {
                if chatStore.loadingMore {
                    ProgressView()
                        .padding(.vertical, 12)
                }
            }
            .task {
                guard chatStore.hasMore,
                      !chatStore.messages.isEmpty,
                      !chatStore.loadingMore,
                      !paginationCooldown else { return }
                paginationCooldown = true
                oldestMessageIdBeforeLoad = chatStore.messages.first?.id
                await chatStore.fetchMoreMessages()
                try? await Task.sleep(for: .milliseconds(300))
                paginationCooldown = false
            }
    }

    // MARK: - Date Separator

    private func dateSeparator(label: String) -> some View {
        DateSeparatorView(label: label)
    }

    // MARK: - Unread Banner

    private var unreadBanner: some View {
        UnreadBanner(count: unreadCount) {
            unreadCount = 0
            isNearBottom = true
            shouldAnimateScroll = true
            scrollTarget = Self.bottomAnchorId
        }
    }

    // MARK: - Empty / Loading Overlay

    @ViewBuilder
    private var emptyOrLoadingOverlay: some View {
        if chatStore.loading {
            ProgressView("Loading messages…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ContentUnavailableView {
                Label("No Messages", systemImage: "bubble.left.and.bubble.right")
            } description: {
                Text("No messages yet. Say something!")
            }
        }
    }

    // MARK: - New Message Handling

    private func handleNewMessage(oldLastId: String?, newLastId: String?) {
        guard let newLastId, newLastId != oldLastId else { return }

        // Initial load — also explicitly scroll to bottom as a belt-and-suspenders
        // approach alongside .defaultScrollAnchor(.bottom)
        guard oldLastId != nil else {
            logger.debug("Initial load, scrolling to bottom")
            shouldAnimateScroll = false
            scrollTarget = Self.bottomAnchorId
            return
        }

        if isNearBottom {
            logger.debug("Auto-scrolling to new message \(newLastId)")
            // Auto-scroll to the new message
            shouldAnimateScroll = true
            scrollTarget = Self.bottomAnchorId
        } else {
            // User is scrolled up — show unread banner
            withAnimation(.easeInOut(duration: 0.2)) {
                unreadCount += 1
            }
        }
    }
}

// MARK: - Date Separator View

private struct DateSeparatorView: View {
    let label: String

    var body: some View {
        HStack(spacing: 8) {
            VStack { Divider() }
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .layoutPriority(1)
            VStack { Divider() }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Date: \(label)")
    }
}

// MARK: - Unread Banner

private struct UnreadBanner: View {
    let count: Int
    let onTap: () -> Void

    var body: some View {
        Button {
            onTap()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "arrow.down")
                    .font(.caption2.bold())
                Text("\(count) new \(count == 1 ? "message" : "messages")")
                    .font(.caption.bold())
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.thinMaterial)
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .padding(.bottom, 8)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .accessibilityLabel("\(count) new \(count == 1 ? "message" : "messages"). Tap to scroll to bottom.")
    }
}

// MARK: - Near-Bottom Scroll Tracking

private extension View {
    /// Tracks whether the scroll view is near the bottom.
    /// Uses `onScrollGeometryChange` on iOS 18+; falls back to staying `true` on iOS 17
    /// (the `onChange(of: messages.last?.id)` handler handles unread counting heuristically).
    @ViewBuilder
    func scrollNearBottomTracking(_ isNearBottom: Binding<Bool>) -> some View {
        if #available(iOS 18.0, *) {
            self.onScrollGeometryChange(for: Bool.self) { geometry in
                let distanceFromBottom = geometry.contentSize.height
                    - geometry.contentOffset.y
                    - geometry.containerSize.height
                return distanceFromBottom < 120
            } action: { _, newValue in
                isNearBottom.wrappedValue = newValue
            }
        } else {
            self
        }
    }
}

// MARK: - Preview

#Preview {
    MessageListView(
        emojiPickerMessageId: nil,
        onReact: { _, _ in },
        onLongPress: { _ in },
        onMediaTap: { _ in }
    )
    .environment(ChatStore())
}
