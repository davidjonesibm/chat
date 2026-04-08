import SwiftUI

struct CreateGroupSheet: View {
    @Environment(GroupStore.self) private var groupStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var showError = false

    private var isNameValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Group Name") {
                    TextField("Enter group name", text: $name)
                        .textInputAutocapitalization(.words)
                }

                Section("Description") {
                    TextField("Optional description", text: $description)
                        .textInputAutocapitalization(.sentences)
                }
            }
            .navigationTitle("New Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if groupStore.loading {
                        ProgressView()
                    } else {
                        Button("Create") {
                            Task { await createGroup() }
                        }
                        .disabled(!isNameValid)
                    }
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                if let error = groupStore.error {
                    Text(error)
                }
            }
        }
    }

    private func createGroup() async {
        let desc = description.isEmpty ? nil : description
        let result = await groupStore.createGroup(name: name, description: desc)
        if result != nil {
            dismiss()
        } else if groupStore.error != nil {
            showError = true
        }
    }
}

#Preview {
    CreateGroupSheet()
        .environment(GroupStore())
}
