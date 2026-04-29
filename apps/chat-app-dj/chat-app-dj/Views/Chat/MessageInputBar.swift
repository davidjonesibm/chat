import SwiftUI

// iOS 17+
struct MessageInputBar: View {
    let channelName: String
    let onSend: (String) -> Void
    let onStartTyping: () -> Void
    let onStopTyping: () -> Void
    var onGifTapped: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?
    var hasPendingAttachment: Bool = false

    @State private var messageText = ""
    @State private var wasTyping = false
    @FocusState private var isInputFocused: Bool

    private var trimmedText: String {
        messageText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 8) {
                if let onGifTapped {
                    Button(action: onGifTapped) {
                        Text("GIF")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 4)
                            .background(Color(.systemGray5))
                            .clipShape(.rect(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Send a GIF")
                }

                TextField("Message #\(channelName)", text: $messageText)
                    .textFieldStyle(.roundedBorder)
                    .focused($isInputFocused)
                    .submitLabel(.send)
                    .onSubmit { sendMessage() }
                    .onChange(of: messageText) { _, newValue in
                        handleTypingChange(newValue)
                    }

                Button("Send message", systemImage: "arrow.up.circle.fill", action: sendMessage)
                    .labelStyle(.iconOnly)
                    .font(.title2)
                    .tint(.indigo)
                    .disabled(trimmedText.isEmpty && !hasPendingAttachment)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(.bar)
        .onChange(of: isInputFocused) { _, newValue in
            onFocusChange?(newValue)
        }
    }

    // MARK: - Actions

    private func sendMessage() {
        let text = trimmedText
        guard !text.isEmpty || hasPendingAttachment else { return }
        messageText = ""
        wasTyping = false
        onStopTyping()
        onSend(text)
        // Keep keyboard up after sending — dismiss only via scroll or tap-outside
        isInputFocused = true
    }

    private func handleTypingChange(_ newValue: String) {
        let isEmpty = newValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        if !isEmpty && !wasTyping {
            wasTyping = true
            onStartTyping()
        } else if isEmpty && wasTyping {
            wasTyping = false
            onStopTyping()
        }
    }
}
