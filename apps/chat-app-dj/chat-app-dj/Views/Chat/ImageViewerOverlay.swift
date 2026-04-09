import SwiftUI

// MARK: - Fullscreen Image / GIF Viewer

/// A fullscreen overlay for viewing images and GIFs with pinch-to-zoom and drag-to-dismiss.
/// Presented via `.fullScreenCover` from `ChatView`.
struct ImageViewerOverlay: View {
    let url: URL
    let onDismiss: () -> Void

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var dragOffset: CGSize = .zero
    @State private var backgroundOpacity: Double = 1.0

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Black background
            Color.black
                .opacity(backgroundOpacity)
                .ignoresSafeArea()

            // Centered image
            imageView
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Top bar with close and share buttons
            toolbar
        }
        .statusBarHidden()
    }

    // MARK: - Image

    private var imageView: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .scaleEffect(scale)
                    .offset(y: dragOffset.height)
                    .gesture(magnificationGesture)
                    .gesture(dismissDragGesture)
                    .onTapGesture(count: 2) {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            if scale > 1.0 {
                                scale = 1.0
                                lastScale = 1.0
                            } else {
                                scale = 3.0
                                lastScale = 3.0
                            }
                        }
                    }
            case .failure:
                ContentUnavailableView {
                    Label("Failed to Load", systemImage: "photo.badge.exclamationmark")
                } description: {
                    Text("The image could not be loaded.")
                }
                .foregroundStyle(.white)
            case .empty:
                ProgressView()
                    .tint(.white)
                    .controlSize(.large)
            @unknown default:
                EmptyView()
            }
        }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack {
            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Share image")

            Spacer()

            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Close viewer")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Gestures

    private var magnificationGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let newScale = lastScale * value.magnification
                scale = min(max(newScale, 1.0), 5.0)
            }
            .onEnded { value in
                let newScale = lastScale * value.magnification
                withAnimation(.easeOut(duration: 0.2)) {
                    scale = min(max(newScale, 1.0), 5.0)
                }
                lastScale = scale
            }
    }

    private var dismissDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard scale <= 1.0 else { return }
                dragOffset = value.translation
                let progress = min(abs(value.translation.height) / 300, 1.0)
                backgroundOpacity = 1.0 - (progress * 0.5)
            }
            .onEnded { value in
                guard scale <= 1.0 else { return }
                if abs(value.translation.height) > 150 {
                    onDismiss()
                } else {
                    withAnimation(.easeOut(duration: 0.2)) {
                        dragOffset = .zero
                        backgroundOpacity = 1.0
                    }
                }
            }
    }
}

#Preview {
    ImageViewerOverlay(
        url: URL(string: "https://media.giphy.com/media/3o7aD2saalBwwfp2M0/giphy.gif")!,
        onDismiss: {}
    )
}
