import SwiftUI

struct ChildHomeView: View {
    @EnvironmentObject private var viewModel: AppViewModel

    var body: some View {
        VStack(spacing: 24) {
            PermissionExplanationView()

            Button {
                Task { await viewModel.sendSOS() }
            } label: {
                Text("SOS")
                    .font(.system(size: 54, weight: .black))
                    .frame(width: 210, height: 210)
                    .foregroundStyle(.white)
                    .background(Circle().fill(Color.red))
            }
            .accessibilityLabel("Send SOS alert")

            Toggle("Share my location with paired parents", isOn: Binding(
                get: { viewModel.locationSharingEnabled },
                set: { enabled in
                    Task { await viewModel.setLocationSharing(enabled: enabled) }
                }
            ))
            .toggleStyle(.switch)
            .padding(.horizontal)

            HStack {
                Button("Demo Audio Request") {
                    viewModel.childReceivesDemoRequest(kind: .audio)
                }
                .buttonStyle(.bordered)

                Button("Demo Video Request") {
                    viewModel.childReceivesDemoRequest(kind: .video)
                }
                .buttonStyle(.bordered)
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Child Safety")
        .sheet(item: $viewModel.pendingSessionRequest) { request in
            ChildSessionApprovalView(request: request)
                .interactiveDismissDisabled()
        }
        .fullScreenCover(item: $viewModel.activeSessionRequest) { request in
            ActiveSessionView(request: request)
                .interactiveDismissDisabled()
        }
    }
}
