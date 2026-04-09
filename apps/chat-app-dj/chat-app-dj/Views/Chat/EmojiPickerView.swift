import SwiftUI

// MARK: - Emoji Picker Anchor Preference Key

/// Reports the anchor bounds of the message that should show the emoji picker.
struct EmojiPickerAnchorKey: PreferenceKey {
    static var defaultValue: Anchor<CGRect>?
    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
        if let next = nextValue() { value = next }
    }
}

// MARK: - Emoji Picker View

/// A compact floating pill showing common reaction emojis and a Copy action.
/// Appears near the long-pressed message, similar to iMessage/Slack reaction pickers.
struct EmojiPickerView: View {
    let onSelectEmoji: (String) -> Void
    let onCopy: () -> Void

    private let emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👎"]

    var body: some View {
        HStack(spacing: 2) {
            ForEach(emojis, id: \.self) { emoji in
                Button {
                    onSelectEmoji(emoji)
                } label: {
                    Text(emoji)
                        .font(.title2)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("React with \(emoji)")
            }

            Divider()
                .frame(height: 24)
                .padding(.horizontal, 2)

            Button {
                onCopy()
            } label: {
                Image(systemName: "doc.on.doc")
                    .font(.body.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Copy message")
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
    }
}

#Preview {
    EmojiPickerView(
        onSelectEmoji: { _ in },
        onCopy: {}
    )
    .padding()
}
