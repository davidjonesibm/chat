import UIKit

// MARK: - Image Cache

/// A global in-memory image cache that coalesces concurrent requests for the same URL.
/// Survives view destruction by `LazyVStack` because it's a singleton, not view-scoped.
actor ImageCache {

    static let shared = ImageCache()

    private let cache = NSCache<NSString, UIImage>()
    private var inFlight: [URL: Task<UIImage, Error>] = [:]

    private init() {
        cache.countLimit = 200
    }

    // MARK: - Synchronous Lookup

    /// Returns a cached image immediately, or `nil` if not cached.
    /// This is `nonisolated` so SwiftUI views can check the cache without awaiting.
    nonisolated func cachedImage(for url: URL) -> UIImage? {
        cache.object(forKey: url.absoluteString as NSString)
    }

    // MARK: - Async Fetch (with coalescing)

    /// Returns the cached image or fetches it from the network.
    /// Concurrent calls for the same URL share a single network request.
    func image(for url: URL) async throws -> UIImage {
        let key = url.absoluteString as NSString

        // 1. Check cache
        if let cached = cache.object(forKey: key) {
            return cached
        }

        // 2. Join an existing in-flight request if one exists
        if let existing = inFlight[url] {
            return try await existing.value
        }

        // 3. Start a new fetch and store it so others can coalesce
        let task = Task<UIImage, Error> {
            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                throw ImageCacheError.badResponse
            }

            guard let image = UIImage(data: data) else {
                throw ImageCacheError.invalidData
            }

            return image
        }

        inFlight[url] = task

        do {
            let image = try await task.value
            cache.setObject(image, forKey: key)
            inFlight.removeValue(forKey: url)
            return image
        } catch {
            inFlight.removeValue(forKey: url)
            throw error
        }
    }

    // MARK: - Batch Preload

    /// Preloads multiple URLs concurrently, ignoring individual failures.
    func preload(urls: [URL]) async {
        let uniqueURLs = Set(urls).filter { cachedImage(for: $0) == nil }

        await withTaskGroup(of: Void.self) { group in
            for url in uniqueURLs {
                group.addTask {
                    _ = try? await self.image(for: url)
                }
            }
        }
    }
}

// MARK: - Errors

enum ImageCacheError: Error {
    case badResponse
    case invalidData
}
