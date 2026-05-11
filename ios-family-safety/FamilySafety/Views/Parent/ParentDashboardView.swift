import SwiftUI

struct ParentDashboardView: View {
    @EnvironmentObject private var viewModel: AppViewModel

    var body: some View {
        List {
            Section("Children") {
                if viewModel.children.isEmpty {
                    Text("No paired child account found.")
                        .foregroundStyle(.secondary)
                }

                ForEach(viewModel.children) { child in
                    ChildParentRow(child: child)
                }
            }

            Section("Privacy Constraints") {
                Label("Audio and video require child approval every time.", systemImage: "hand.raised.fill")
                Label("The parent cannot silently start the child microphone or camera.", systemImage: "mic.slash.fill")
                Label("Location is shown only when child location sharing is enabled.", systemImage: "location.fill")
            }
        }
        .navigationTitle("Family Safety")
    }
}

private struct ChildParentRow: View {
    @EnvironmentObject private var viewModel: AppViewModel
    let child: ChildProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(child.displayName)
                        .font(.headline)
                    Text(child.locationSharingEnabled ? "Location sharing on" : "Location sharing off")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let battery = child.batteryLevel {
                    Label("\(Int(battery * 100))%", systemImage: battery < 0.2 ? "battery.25" : "battery.100")
                }
            }

            HStack {
                Button {
                    Task { await viewModel.sendCheckIn(to: child) }
                } label: {
                    Label("Check In", systemImage: "checkmark.message")
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await viewModel.requestLiveSession(kind: .audio, child: child) }
                } label: {
                    Label("Audio", systemImage: "phone")
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await viewModel.requestLiveSession(kind: .video, child: child) }
                } label: {
                    Label("Video", systemImage: "video")
                }
                .buttonStyle(.borderedProminent)
            }

            if let location = child.lastKnownLocation, child.locationSharingEnabled {
                Text("Last location: \(location.latitude), \(location.longitude)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

