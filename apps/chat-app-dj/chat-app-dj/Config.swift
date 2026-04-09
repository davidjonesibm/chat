import Foundation

nonisolated enum Config {
    // Backend API base URL (no trailing slash)
    static let apiBaseURL: String = value(for: "API_BASE_URL")

    // WebSocket URL
    static let wsURL: String = value(for: "WS_URL")

    // Supabase configuration
    static let supabaseURL: String = value(for: "SUPABASE_URL")
    static let supabaseAnonKey: String = value(for: "SUPABASE_ANON_KEY")

    // GIPHY API Key
    static let giphyAPIKey: String = value(for: "GIPHY_API_KEY")

    // MARK: - Helpers

    private static func value(for key: String) -> String {
        guard let value = Bundle.main.infoDictionary?[key] as? String, !value.isEmpty else {
            fatalError("Missing or empty Info.plist key: \(key). Check that Secrets.xcconfig is configured.")
        }
        return value
    }
}
