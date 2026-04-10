import SwiftUI

// MARK: - User Avatar View

/// Displays a user's avatar image, or a colored-circle with initials as fallback.
struct UserAvatarView: View {
    let username: String
    let avatarUrl: String?
    var size: CGFloat = 32

    var body: some View {
        if let urlString = resolvedAvatarURL, let url = URL(string: urlString) {
            CachedAsyncImage(url: url) {
                initialsCircle
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            initialsCircle
        }
    }

    // MARK: - Initials Fallback

    private var initialsCircle: some View {
        Circle()
            .fill(avatarColor)
            .frame(width: size, height: size)
            .overlay {
                Text(initials)
                    .font(.system(size: size * 0.45, weight: .semibold))
                    .foregroundStyle(.white)
            }
    }

    private var initials: String {
        let first = username.first.map { String($0).uppercased() } ?? "?"
        return first
    }

    // MARK: - Consistent Color from Username

    private var avatarColor: Color {
        let hash = username.unicodeScalars.reduce(0) { acc, scalar in
            acc &+ Int(scalar.value) &* 31
        }
        let colors: [Color] = [
            .red, .orange, .yellow, .green, .mint,
            .teal, .cyan, .blue, .indigo, .purple, .pink
        ]
        let index = abs(hash) % colors.count
        return colors[index]
    }

    // MARK: - URL Resolution

    /// Resolves the avatar URL. If the path is already absolute, use it as-is.
    /// Otherwise prepend the Supabase storage base URL.
    private var resolvedAvatarURL: String? {
        guard let avatar = avatarUrl, !avatar.isEmpty else { return nil }
        if avatar.hasPrefix("http") {
            return avatar
        }
        return Config.supabaseURL + avatar
    }
}

// MARK: - Previews

#Preview("With Avatar") {
    UserAvatarView(
        username: "alice",
        avatarUrl: nil,
        size: 40
    )
}

#Preview("Initials Fallback") {
    HStack(spacing: 12) {
        UserAvatarView(username: "Alice", avatarUrl: nil, size: 32)
        UserAvatarView(username: "Bob", avatarUrl: nil, size: 32)
        UserAvatarView(username: "Charlie", avatarUrl: nil, size: 32)
        UserAvatarView(username: "Diana", avatarUrl: nil, size: 32)
    }
}
