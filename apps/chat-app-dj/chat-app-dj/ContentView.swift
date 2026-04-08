import SwiftUI

struct ContentView: View {
    @State private var authStore = AuthStore()
    @State private var router = Router()
    @State private var hasInitialized = false

    var body: some View {
        Group {
            if !hasInitialized {
                ProgressView("Loading...")
            } else if authStore.isAuthenticated {
                AuthenticatedRootView()
                    .environment(authStore)
                    .environment(router)
            } else {
                AuthNavigationView()
                    .environment(authStore)
            }
        }
        .task {
            await authStore.initAuth()
            hasInitialized = true
        }
    }
}


