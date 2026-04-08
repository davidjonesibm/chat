import SwiftUI

// iOS 17+
struct TypingIndicatorView: View {
    let typingUsers: [String]

    @State private var animateDots = false

    private var text: String {
        switch typingUsers.count {
        case 0: ""
        case 1: "\(typingUsers[0]) is typing…"
        case 2: "\(typingUsers[0]) and \(typingUsers[1]) are typing…"
        default: "\(typingUsers.count) people are typing…"
        }
    }

    var body: some View {
        if !typingUsers.isEmpty {
            HStack(spacing: 4) {
                Text(text)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(Color.secondary)
                            .frame(width: 5, height: 5)
                            .offset(y: animateDots ? -4 : 0)
                            .animation(
                                .easeInOut(duration: 0.4)
                                    .repeatForever(autoreverses: true)
                                    .delay(Double(index) * 0.15),
                                value: animateDots
                            )
                    }
                }
            }
            .padding(.leading, 52)
            .padding(.trailing, 16)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.bar)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
            .onAppear {
                animateDots = true
            }
            .onDisappear {
                animateDots = false
            }
        }
    }
}

#Preview("One user") {
    VStack {
        Spacer()
        TypingIndicatorView(typingUsers: ["David"])
    }
}

#Preview("Two users") {
    VStack {
        Spacer()
        TypingIndicatorView(typingUsers: ["David", "Sarah"])
    }
}

#Preview("Three+ users") {
    VStack {
        Spacer()
        TypingIndicatorView(typingUsers: ["David", "Sarah", "Alex"])
    }
}
