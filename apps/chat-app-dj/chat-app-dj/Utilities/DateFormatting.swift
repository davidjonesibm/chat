import Foundation

// MARK: - Date Formatting Utilities

enum DateFormatting {

    // MARK: - Formatters

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short // locale-appropriate short time (e.g. "14:30" or "2:30 PM")
        return f
    }()

    private static let weekdayDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d" // e.g. "Mon, Apr 7"
        return f
    }()

    // MARK: - Public API

    /// Parse an ISO 8601 date string.
    static func parseDate(_ isoString: String) -> Date? {
        try? Date(isoString, strategy: Date.ISO8601FormatStyle(timeZone: .gmt))
            ?? Date(isoString, strategy: .iso8601)
    }

    /// Returns a locale-appropriate short time string (e.g. "14:30" or "2:30 PM").
    static func formatTime(_ isoString: String) -> String {
        guard let date = parseDate(isoString) else { return "" }
        return timeFormatter.string(from: date)
    }

    /// Returns "Today", "Yesterday", or a short weekday+date label.
    static func formatDateLabel(_ isoString: String) -> String {
        guard let date = parseDate(isoString) else { return "" }

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            return weekdayDateFormatter.string(from: date)
        }
    }
}
