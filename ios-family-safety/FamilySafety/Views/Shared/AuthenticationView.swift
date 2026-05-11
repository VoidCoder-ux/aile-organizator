import SwiftUI

struct AuthenticationView: View {
    @EnvironmentObject private var viewModel: AppViewModel
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        Form {
            Section("Sign In") {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)

                SecureField("Password", text: $password)

                Button {
                    Task { await viewModel.signIn(email: email, password: password) }
                } label: {
                    Label("Sign In", systemImage: "person.crop.circle")
                }
                .disabled(email.isEmpty || password.isEmpty)
            }

            Section("Pairing") {
                Text("Create parent and child accounts in Firebase Authentication, then pair them in Firestore under the same family. Parent and child roles are enforced by Firestore rules.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Family Safety")
    }
}
