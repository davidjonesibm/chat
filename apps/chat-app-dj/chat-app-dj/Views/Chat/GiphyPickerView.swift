import SwiftUI
import GiphyUISDK
import os

private let logger = Logger(subsystem: "com.chatapp", category: "giphy")

struct GiphyPickerView: View {
    let onGifSelected: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GiphyView()
            .onSelectMedia { media, contentType in
                let gifURL = media.url(rendition: .fixedWidth, fileType: .gif)
                    ?? "https://media.giphy.com/media/\(media.id)/giphy.gif"
                onGifSelected(gifURL)
                dismiss()
            }
            .onDismiss {
                dismiss()
            }
            .onError { error in
                logger.error("GIPHY SDK error: \(error.localizedDescription)")
            }
    }
}
