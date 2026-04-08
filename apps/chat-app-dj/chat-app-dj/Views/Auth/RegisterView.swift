import SwiftUI

struct RegisterView: View {
    @Environment(AuthStore.self) private var authStore
    @Binding var showRegister: Bool

    @State private var email = ""
    @State private var username = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var validationError: String?

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, username, password, confirmPassword
    }

    private var passwordsMatch: Bool {
        password == confirmPassword
    }

    private var canSubmit: Bool {
        !email.isEmpty && !username.isEmpty &&
        !password.isEmpty && !confirmPassword.isEmpty &&
        passwordsMatch && !authStore.loading
    }

    private var displayError: String? {
        validationError ?? authStore.error
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

                    Text("Create Account")
                        .font(.largeTitle.bold())

                    Text("Join the conversation")
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
                        .onSubmit { focusedField = .username }
                        .padding()
                        .background(.fill.tertiary, in: .rect(cornerRadius: 12))

                    TextField("Username", text: $username)
                        .focused($focusedField, equals: .username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.username)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .password }
                        .padding()
                        .background(.fill.tertiary, in: .rect(cornerRadius: 12))

                    SecureField("Password", text: $password)
                        .focused($focusedField, equals: .password)
                        .textContentType(.newPassword)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .confirmPassword }
                        .padding()
                        .background(.fill.tertiary, in: .rect(cornerRadius: 12))

                    VStack(alignment: .leading, spacing: 6) {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .focused($focusedField, equals: .confirmPassword)
                            .textContentType(.newPassword)
                            .submitLabel(.done)
                            .onSubmit { createAccount() }
                            .padding()
                            .background(.fill.tertiary, in: .rect(cornerRadius: 12))

                        if !confirmPassword.isEmpty && !passwordsMatch {
                            Label("Passwords do not match", systemImage: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.red)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }
                    .animation(.default, value: passwordsMatch)
                }

                // MARK: - Error
                if let error = displayError {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // MARK: - Create Account Button
                Button {
                    createAccount()
                } label: {
                    ZStack {
                        if authStore.loading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Create Account")
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

                // MARK: - Login Link
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .foregroundStyle(.secondary)

                    Button("Sign In") {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showRegister = false
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
        .animation(.default, value: displayError)
        .onAppear { focusedField = .email }
    }

    private func createAccount() {
        guard canSubmit else { return }
        validationError = nil
        focusedField = nil

        guard passwordsMatch else {
            validationError = "Passwords do not match."
            return
        }

        Task {
            await authStore.register(
                email: email,
                password: password,
                username: username
            )
        }
    }
}

#Preview {
    NavigationStack {
        RegisterView(showRegister: .constant(true))
            .environment(AuthStore())
    }
}
