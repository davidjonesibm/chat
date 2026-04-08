import SwiftUI

/// Handles login/register navigation for unauthenticated users.
struct AuthNavigationView: View {
    @Environment(AuthStore.self) private var authStore
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            if showRegister {
                RegisterView(showRegister: $showRegister)
            } else {
                LoginView(showRegister: $showRegister)
            }
        }
    }
}
