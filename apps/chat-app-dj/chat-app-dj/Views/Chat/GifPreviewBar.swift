import SwiftUI

struct GifPreviewBar: View {
    let gifUrl: String
    let onCancel: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            AsyncImage(url: URL(string: gifUrl)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Color.secondary.opacity(0.2)
                case .empty:
                    Color.secondary.opacity(0.2)
                        .overlay { ProgressView() }
                @unknown default:
                    Color.secondary.opacity(0.2)
                }
            }
            .frame(width: 60, height: 44)
            .clipShape(.rect(cornerRadius: 6))

            Text("GIF selected — add a caption or send")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer()

            Button("Remove GIF", systemImage: "xmark.circle.fill", action: onCancel)
                .labelStyle(.iconOnly)
                .font(.title3)
                .foregroundStyle(.secondary)
                .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.bar)
    }
}
