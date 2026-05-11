import SwiftUI

struct ActiveSessionView: View {
    @EnvironmentObject private var viewModel: AppViewModel
    let request: SessionRequest

    var body: some View {
        VStack(spacing: 28) {
            HStack {
                Label("Live \(request.kind.rawValue.capitalized) Active", systemImage: request.kind == .video ? "video.fill" : "mic.fill")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding()
            .background(Color.red)

            Spacer()

            VStack(spacing: 14) {
                Image(systemName: request.kind == .video ? "video.circle.fill" : "mic.circle.fill")
                    .font(.system(size: 92))
                    .foregroundStyle(.red)

                Text(request.kind == .video ? "Your camera and microphone are in use." : "Your microphone is in use.")
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)

                Text("This screen stays visible during the session.")
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button(role: .destructive) {
                Task { await viewModel.endActiveSession() }
            } label: {
                Label("End Session", systemImage: "stop.circle.fill")
                    .font(.title3.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .padding()
        }
        .task {
            await viewModel.startVisibleApprovedSession()
        }
    }
}

