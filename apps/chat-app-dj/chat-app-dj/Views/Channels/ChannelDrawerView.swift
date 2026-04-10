import SwiftUI

struct ChannelDrawerView: View {
    let groupId: String
    let groupName: String
    let selectedChannelId: String?
    let onSelectChannel: (String) -> Void
    let onCreateChannel: () -> Void
    let onBack: () -> Void

    @Environment(ChannelStore.self) private var channelStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // MARK: - Header
            VStack(spacing: 0) {
                HStack {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                                .font(.body.weight(.semibold))
                            Text("Groups")
                                .font(.body)
                        }
                    }

                    Spacer()

                    Button("Create channel", systemImage: "plus", action: onCreateChannel)
                        .labelStyle(.iconOnly)
                        .font(.body.weight(.semibold))
                }
                .padding(.horizontal)
                .padding(.vertical, 12)

                Text(groupName)
                    .font(.title3.bold())
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.bottom, 12)

                Divider()
            }
            .background(.bar)

            // MARK: - Channel List
            if channelStore.channels.isEmpty && channelStore.loading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if channelStore.channels.isEmpty {
                ContentUnavailableView(
                    "No Channels",
                    systemImage: "number",
                    description: Text("Tap + to create one.")
                )
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(channelStore.channels) { channel in
                            channelRow(channel)
                        }
                    }
                    .padding(8)
                }
            }
        }
        .background(.background)
    }

    // MARK: - Channel Row

    private func channelRow(_ channel: ChatChannel) -> some View {
        let isSelected = channel.id == selectedChannelId

        return Button {
            onSelectChannel(channel.id)
        } label: {
            HStack {
                Text("# \(channel.name)")
                    .font(.body.weight(isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? .white : .primary)

                Spacer()

                if channel.isDefault {
                    Text("default")
                        .font(.caption2)
                        .foregroundStyle(isSelected ? .white.opacity(0.7) : .secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                isSelected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.clear),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Channel \(channel.name)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
