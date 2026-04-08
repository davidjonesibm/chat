import SwiftUI

struct LoginView: View {
    @Environment(AuthStore.self) private var authStore
    @Binding var showRegister: Bool

    @State private var email = ""
    @State private var password = ""

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, password
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !authStore.loading
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                // MARK: - Header
                VStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(.indigo.gradient)
                        .padding(.bottom, 4)

                    Text("Welcome Back")
                        .font(.largeTitle.bold())

                    Text("Sign in to continue")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 40)

                // MARK: - Form Fields
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .focused($focusedField, equals: .email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.emailAddress)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .password }
                        .padding()
                        .background(.fill.tertiary, in: .rect(cornerRadius: 12))

                    SecureField("Password", text: $password)
                        .focused($focusedField, equals: .password)
                        .textContentType(.password)
                        .submitLabel(.done)
                        .onSubmit { signIn() }
                        .padding()
                        .background(.fill.tertiary, in: .rect(cornerRadius: 12))
                }

                // MARK: - Error
                if let error = authStore.error {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // MARK: - Sign In Button
                Button {
                    signIn()
                } label: {
                    ZStack {
                        if authStore.loading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 24)
                }
                .buttonStyle(.borderedProminent)
                .tint(.indigo)
                .controlSize(.large)
                .clipShape(.rect(cornerRadius: 12))
                .disabled(!canSubmit)

                // MARK: - Register Link
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundStyle(.secondary)

                    Button("Sign Up") {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showRegister = true
                        }
                    }
                    .fontWeight(.semibold)
                    .tint(.indigo)
                }
                .font(.subheadline)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar(.hidden, for: .navigationBar)
        .animation(.default, value: authStore.error)
        .onAppear { focusedField = .email }
    }

    private func signIn() {
        guard canSubmit else { return }
        focusedField = nil
        Task {
            await authStore.login(email: email, password: password)
        }
    }
}

#Preview {
    NavigationStack {
        LoginView(showRegister: .constant(false))
            .environment(AuthStore())
    }
}
