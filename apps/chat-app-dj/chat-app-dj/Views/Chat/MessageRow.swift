import SwiftUI
import GiphyUISDK

// MARK: - Message Row (Slack-style, no bubbles)

/// A single message row matching the Slack-style layout from the Vue web app.
/// System messages render as centered dividers; regular messages use avatar + content columns.
struct MessageRow: View {
    let message: MessageWithSender
    let isNewSender: Bool
    let emojiPickerMessageId: String?
    let onReact: (String, String) -> Void   // (messageId, emoji)
    let onLongPress: (MessageWithSender) -> Void
    let onMediaTap: (URL) -> Void

    @Environment(AuthStore.self) private var authStore

    @State private var isHighlighted = false

    private var currentUserId: String {
        authStore.user?.id ?? ""
    }

    private var visibleReactions: [ReactionSummary] {
        message.reactions?.filter { $0.count > 0 } ?? []
    }

    var body: some View {
        if message.type == .system {
            systemDivider
        } else {
            regularMessage
        }
    }

    // MARK: - System Message (Centered Divider)

    private var systemDivider: some View {
        SystemMessageDivider(content: message.content)
    }

    // MARK: - Regular Message (Slack-style)

    private var regularMessage: some View {
        HStack(alignment: .top, spacing: 8) {
            // Left column: avatar or spacer (36pt wide)
            avatarColumn

            // Right column: header + content + reactions
            VStack(alignment: .leading, spacing: 2) {
                if isNewSender {
                    headerRow
                }
                messageContent
                if !visibleReactions.isEmpty {
                    reactionsRow
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, isNewSender ? 4 : 1)
        .background(isHighlighted ? Color.primary.opacity(0.06) : Color.clear)
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 0.5, pressing: { pressing in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHighlighted = pressing
            }
        }, perform: {
            onLongPress(message)
        })
        .anchorPreference(key: EmojiPickerAnchorKey.self, value: .bounds) { anchor in
            emojiPickerMessageId == message.id ? anchor : nil
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    // MARK: - Avatar Column

    private var avatarColumn: some View {
        VStack {
            if isNewSender {
                UserAvatarView(
                    username: message.sender.username,
                    avatarUrl: message.sender.avatar,
                    size: 32
                )
            }
        }
        .frame(width: 36, alignment: .center)
    }

    // MARK: - Header (Username + Timestamp)

    private var headerRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(message.sender.username)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)

            Text(DateFormatting.formatTime(message.createdAt))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    // MARK: - Message Content

    @ViewBuilder
    private var messageContent: some View {
        switch message.type {
        case .text, .system:
            Text(message.content)
                .font(.body)
                .foregroundStyle(.primary)
                .lineSpacing(4)
                .textSelection(.enabled)

        case .giphy:
            giphyContent

        case .image:
            imageContent
        }
    }

    // MARK: - Giphy Content

    private var giphyContent: some View {
        GiphyContentView(gifUrl: message.gifUrl, content: message.content, onMediaTap: onMediaTap)
    }

    /// Extracts the GIPHY media ID from URLs like
    /// `https://media.giphy.com/media/{ID}/giphy.gif` or
    /// `https://i.giphy.com/media/{ID}/200w.gif`.
    static func extractGiphyMediaId(from urlString: String) -> String? {
        guard let url = URL(string: urlString) else { return nil }
        let components = url.pathComponents
        guard let mediaIndex = components.firstIndex(of: "media"),
              mediaIndex + 1 < components.count else { return nil }
        let candidate = components[mediaIndex + 1]
        return candidate.isEmpty ? nil : candidate
    }

    // MARK: - Image Content

    private var imageContent: some View {
        ImageContentView(imageUrl: message.imageUrl, content: message.content, onMediaTap: onMediaTap)
    }

    // MARK: - Reactions Row

    private var reactionsRow: some View {
        MessageReactionsRow(
            reactions: visibleReactions,
            currentUserId: currentUserId,
            onReact: { emoji in onReact(message.id, emoji) },
            onAddReaction: { onLongPress(message) }
        )
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        let time = DateFormatting.formatTime(message.createdAt)
        return "Message from \(message.sender.username) at \(time): \(message.content)"
    }
}

// MARK: - System Message Divider

private struct SystemMessageDivider: View {
    let content: String

    var body: some View {
        HStack(spacing: 8) {
            dashedLine
            Text(content)
                .font(.caption)
                .italic()
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            dashedLine
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("System message: \(content)")
    }

    private var dashedLine: some View {
        VStack { Divider() }
    }
}

// MARK: - Message Reactions Row

private struct MessageReactionsRow: View {
    let reactions: [ReactionSummary]
    let currentUserId: String
    let onReact: (String) -> Void
    let onAddReaction: () -> Void

    var body: some View {
        FlowLayout(spacing: 4) {
            ForEach(reactions, id: \.emoji) { reaction in
                reactionBadge(reaction)
            }

            // Add reaction button
            Button {
                onAddReaction()
            } label: {
                Image(systemName: "face.smiling")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add reaction")
        }
        .padding(.top, 2)
    }

    private func reactionBadge(_ reaction: ReactionSummary) -> some View {
        let isOwn = reaction.userIds.contains(currentUserId)
        return Button {
            onReact(reaction.emoji)
        } label: {
            HStack(spacing: 3) {
                Text(reaction.emoji)
                .font(.footnote)
                Text("\(reaction.count)")
                    .font(.caption)
                    .foregroundStyle(isOwn ? Color.accentColor : .secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color(.systemGray6))
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .strokeBorder(isOwn ? Color.accentColor : Color(.systemGray4), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(reaction.emoji) \(reaction.count) reactions")
        .accessibilityHint(isOwn ? "Tap to remove your reaction" : "Tap to react")
    }
}

// MARK: - Giphy Content View

private struct GiphyContentView: View {
    let gifUrl: String?
    let content: String
    let onMediaTap: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let gifUrl,
               let mediaId = MessageRow.extractGiphyMediaId(from: gifUrl) {
                GiphyAnimatedView(mediaId: mediaId)
                    .frame(width: 250, height: 180)
                    .clipShape(.rect(cornerRadius: 8))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if let url = URL(string: gifUrl) {
                            onMediaTap(url)
                        }
                    }
            } else if let gifUrl, let url = URL(string: gifUrl) {
                // Fallback for non-standard GIPHY URLs
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 250, height: 180)
                            .clipped()
                    case .failure:
                        mediaThumbnailPlaceholder(label: "Failed to load GIF")
                    case .empty:
                        mediaThumbnailPlaceholder(label: "Loading…")
                            .overlay { ProgressView() }
                    @unknown default:
                        mediaThumbnailPlaceholder(label: "GIF")
                    }
                }
                .frame(width: 250, height: 180)
                .clipShape(.rect(cornerRadius: 8))
                .contentShape(Rectangle())
                .onTapGesture {
                    onMediaTap(url)
                }
            }

            if !content.isEmpty {
                Text(content)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineSpacing(4)
            }
        }
    }

    private func mediaThumbnailPlaceholder(label: String) -> some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .frame(width: 250, height: 180)
            .overlay {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Image Content View

private struct ImageContentView: View {
    let imageUrl: String?
    let content: String
    let onMediaTap: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let resolvedURL, let url = URL(string: resolvedURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: 250, height: 180)
                            .clipped()
                    case .failure:
                        mediaThumbnailPlaceholder(label: "Failed to load image")
                    case .empty:
                        mediaThumbnailPlaceholder(label: "Loading…")
                            .overlay { ProgressView() }
                    @unknown default:
                        mediaThumbnailPlaceholder(label: "Image")
                    }
                }
                .frame(width: 250, height: 180)
                .clipShape(.rect(cornerRadius: 8))
                .contentShape(Rectangle())
                .onTapGesture {
                    onMediaTap(url)
                }
            }

            if !content.isEmpty {
                Text(content)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineSpacing(4)
            }
        }
    }

    /// Resolve image_url: if already absolute, use as-is; otherwise prepend Supabase URL.
    private var resolvedURL: String? {
        guard let imageUrl, !imageUrl.isEmpty else { return nil }
        if imageUrl.hasPrefix("http") { return imageUrl }
        return Config.supabaseURL + imageUrl
    }

    private func mediaThumbnailPlaceholder(label: String) -> some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .frame(width: 250, height: 180)
            .overlay {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Giphy Animated GIF View (UIViewRepresentable)

/// Wraps the GIPHY SDK's `GPHMediaView` for native animated GIF rendering.
private struct GiphyAnimatedView: UIViewRepresentable {
    let mediaId: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .secondarySystemBackground
        container.layer.cornerRadius = 8
        container.clipsToBounds = true

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        spinner.tag = 100
        container.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])

        let mediaView = GPHMediaView()
        mediaView.translatesAutoresizingMaskIntoConstraints = false
        mediaView.contentMode = .scaleAspectFit
        mediaView.clipsToBounds = true
        container.addSubview(mediaView)
        NSLayoutConstraint.activate([
            mediaView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            mediaView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            mediaView.topAnchor.constraint(equalTo: container.topAnchor),
            mediaView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        context.coordinator.mediaView = mediaView
        context.coordinator.currentMediaId = mediaId

        fetchMedia(mediaId: mediaId, container: container, mediaView: mediaView)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        guard context.coordinator.currentMediaId != mediaId else { return }
        context.coordinator.currentMediaId = mediaId
        if let mediaView = context.coordinator.mediaView {
            fetchMedia(mediaId: mediaId, container: uiView, mediaView: mediaView)
        }
    }

    private func fetchMedia(mediaId: String, container: UIView, mediaView: GPHMediaView) {
        GiphyCore.shared.gifByID(mediaId) { response, error in
            Task { @MainActor in
                container.viewWithTag(100)?.removeFromSuperview()
                if let media = response?.data {
                    mediaView.setMedia(media)
                } else {
                    let label = UILabel()
                    label.text = "GIF unavailable"
                    label.font = .preferredFont(forTextStyle: .caption1)
                    label.textColor = .secondaryLabel
                    label.textAlignment = .center
                    label.translatesAutoresizingMaskIntoConstraints = false
                    container.addSubview(label)
                    NSLayoutConstraint.activate([
                        label.centerXAnchor.constraint(equalTo: container.centerXAnchor),
                        label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                    ])
                }
            }
        }
    }

    final class Coordinator {
        var mediaView: GPHMediaView?
        var currentMediaId: String?
    }
}

// MARK: - Flow Layout (wrapping horizontal layout for reactions)

/// A simple wrapping horizontal layout for reaction badges.
struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let result = arrangeSubviews(
            proposal: ProposedViewSize(width: bounds.width, height: bounds.height),
            subviews: subviews
        )
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private struct ArrangementResult {
        var size: CGSize
        var positions: [CGPoint]
    }

    private func arrangeSubviews(proposal: ProposedViewSize, subviews: Subviews) -> ArrangementResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                // Wrap to next row
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            totalWidth = max(totalWidth, x - spacing)
            totalHeight = y + rowHeight
        }

        return ArrangementResult(
            size: CGSize(width: totalWidth, height: totalHeight),
            positions: positions
        )
    }
}

// MARK: - Previews

#Preview("Text Message - New Sender") {
    MessageRow(
        message: MessageWithSender(
            id: "1",
            seq: 1,
            content: "Hey everyone! How's it going? This is a regular text message.",
            channel: "ch1",
            sender: MessageSender(id: "u1", username: "alice", avatar: nil),
            type: .text,
            gifUrl: nil,
            imageUrl: nil,
            createdAt: ISO8601DateFormatter().string(from: .now),
            updatedAt: ISO8601DateFormatter().string(from: .now),
            reactions: [
                ReactionSummary(emoji: "👍", count: 3, userIds: ["u1", "u2", "u3"]),
                ReactionSummary(emoji: "❤️", count: 1, userIds: ["u2"])
            ]
        ),
        isNewSender: true,
        emojiPickerMessageId: nil,
        onReact: { _, _ in },
        onLongPress: { _ in },
        onMediaTap: { _ in }
    )
    .environment(AuthStore())
}

#Preview("Continuation Message") {
    MessageRow(
        message: MessageWithSender(
            id: "2",
            seq: 2,
            content: "This is a follow-up message from the same sender.",
            channel: "ch1",
            sender: MessageSender(id: "u1", username: "alice", avatar: nil),
            type: .text,
            gifUrl: nil,
            imageUrl: nil,
            createdAt: ISO8601DateFormatter().string(from: .now),
            updatedAt: ISO8601DateFormatter().string(from: .now),
            reactions: nil
        ),
        isNewSender: false,
        emojiPickerMessageId: nil,
        onReact: { _, _ in },
        onLongPress: { _ in },
        onMediaTap: { _ in }
    )
    .environment(AuthStore())
}

#Preview("System Message") {
    MessageRow(
        message: MessageWithSender(
            id: "3",
            seq: 3,
            content: "alice joined the channel",
            channel: "ch1",
            sender: MessageSender(id: "system", username: "System", avatar: nil),
            type: .system,
            gifUrl: nil,
            imageUrl: nil,
            createdAt: ISO8601DateFormatter().string(from: .now),
            updatedAt: ISO8601DateFormatter().string(from: .now),
            reactions: nil
        ),
        isNewSender: true,
        emojiPickerMessageId: nil,
        onReact: { _, _ in },
        onLongPress: { _ in },
        onMediaTap: { _ in }
    )
    .environment(AuthStore())
}
