import SwiftUI

struct ChildSessionApprovalView: View {
    @EnvironmentObject private var viewModel: AppViewModel
    let request: SessionRequest

    var body: some View {
        VStack(spacing: 26) {
            Image(systemName: request.kind == .video ? "video.fill" : "phone.fill")
                .font(.system(size: 64))
                .foregroundStyle(.blue)

            Text("Parent requests \(request.kind.rawValue) access")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text("Your microphone\(request.kind.requiresCamera ? " and camera" : "") will not start unless you tap Accept. You can end the session at any time.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            HStack(spacing: 14) {
                Button(role: .cancel) {
                    Task { await viewModel.declinePendingSession() }
                } label: {
                    Label("Decline", systemImage: "xmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await viewModel.acceptPendingSession() }
                } label: {
                    Label("Accept", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal)
        }
        .padding()
    }
}

