import SwiftUI
import GiphyUISDK
import os

private let logger = Logger(subsystem: "com.chatapp", category: "giphy")

struct GiphyPickerView: View {
    let onGifSelected: (String, Int?, Int?) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GiphyView()
            .onSelectMedia { media, contentType in
                let gifURL = media.url(rendition: .fixedWidth, fileType: .gif)
                    ?? "https://media.giphy.com/media/\(media.id)/giphy.gif"
                let gifWidth: Int?
                let gifHeight: Int?
                let ar = media.aspectRatio
                if ar > 0 {
                    gifWidth = 200
                    gifHeight = Int(round(200.0 / ar))
                } else {
                    gifWidth = nil
                    gifHeight = nil
                }
                onGifSelected(gifURL, gifWidth, gifHeight)
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
