import SwiftUI

struct PermissionExplanationView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Microphone", systemImage: "mic.fill")
                .font(.headline)
            Text("Used only after you approve a parent audio or video request.")
                .foregroundStyle(.secondary)

            Label("Camera", systemImage: "camera.fill")
                .font(.headline)
            Text("Used only after you approve a parent video request. The app shows an active session screen while camera is in use.")
                .foregroundStyle(.secondary)

            Label("Location", systemImage: "location.fill")
                .font(.headline)
            Text("Shared only when you turn on location sharing or send SOS.")
                .foregroundStyle(.secondary)
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

