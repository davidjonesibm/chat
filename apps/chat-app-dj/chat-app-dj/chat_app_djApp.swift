//
//  chat_app_djApp.swift
//  chat-app-dj
//
//  Created by David on 4/7/26.
//

import SwiftUI
import GiphyUISDK

@main
struct chat_app_djApp: App {
    init() {
        Giphy.configure(apiKey: Config.giphyAPIKey)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
