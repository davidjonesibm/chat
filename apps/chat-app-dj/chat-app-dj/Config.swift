import Foundation

nonisolated enum Config {
    // Backend API base URL (no trailing slash)
    static let apiBaseURL: String = "https://192.168.86.20:8443/api"

    // WebSocket URL
    static let wsURL: String = "wss://192.168.86.20:8443/ws"

    // Supabase configuration
    static let supabaseURL: String = "https://192.168.86.20:8443"
    static let supabaseAnonKey: String = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

    // GIPHY API Key
    static let giphyAPIKey: String = "rBNut5aYm9PvYaKt15HrAV981xi6JpGn"
}
