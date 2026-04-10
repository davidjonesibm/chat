import SwiftUI

// MARK: - Cached Async Image

/// A SwiftUI view that loads images through `ImageCache`, avoiding flicker on scroll
/// by checking the cache synchronously before entering the async path.
/// Retries once on failure before falling back to the placeholder.
struct CachedAsyncImage<Placeholder: View>: View {
    let url: URL?
    @ViewBuilder let placeholder: () -> Placeholder

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        content
            .task(id: url) {
                await loadImage()
            }
    }

    @ViewBuilder
    private var content: some View {
        if let image {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            placeholder()
        }
    }

    // MARK: - Loading

    private func loadImage() async {
        guard let url else { return }

        // Synchronous cache hit — no flicker
        if let cached = ImageCache.shared.cachedImage(for: url) {
            image = cached
            return
        }

        // Async fetch with one retry
        for attempt in 0..<2 {
            do {
                let fetched = try await ImageCache.shared.image(for: url)
                image = fetched
                return
            } catch {
                if attempt == 0 {
                    // Brief pause before retry
                    try? await Task.sleep(for: .milliseconds(500))
                }
            }
        }

        // Both attempts failed — stay on placeholder
        failed = true
    }
}
