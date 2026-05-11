import FirebaseAuth
import Foundation

protocol AuthServicing {
    var currentUserId: String? { get }
    func signIn(email: String, password: String) async throws
    func signOut() throws
}

final class FirebaseAuthService: AuthServicing {
    var currentUserId: String? {
        Auth.auth().currentUser?.uid
    }

    func signIn(email: String, password: String) async throws {
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }
}

