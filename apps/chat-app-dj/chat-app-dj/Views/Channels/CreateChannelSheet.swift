import SwiftUI

struct CreateChannelSheet: View {
    let groupId: String

    @Environment(ChannelStore.self) private var channelStore
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
                Section("Channel Name") {
                    TextField("e.g. general", text: $name)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }

                Section("Description") {
                    TextField("What's this channel about?", text: $description)
                }
            }
            .navigationTitle("New Channel")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    if channelStore.loading {
                        ProgressView()
                    } else {
                        Button("Create") {
                            Task {
                                let trimmedDescription = description.isEmpty ? nil : description
                                let channel = await channelStore.createChannel(
                                    name: name,
                                    groupId: groupId,
                                    description: trimmedDescription
                                )
                                if channel != nil {
                                    dismiss()
                                } else if channelStore.error != nil {
                                    showError = true
                                }
                            }
                        }
                        .disabled(!isNameValid)
                    }
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                if let error = channelStore.error {
                    Text(error)
                }
            }
        }
    }
}
