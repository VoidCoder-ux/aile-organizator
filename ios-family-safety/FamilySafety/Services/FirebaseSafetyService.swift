import FirebaseFirestore
import FirebaseFirestoreSwift
import Foundation

protocol FirebaseServicing {
    func loadSignedInMember(userId: String) async throws -> FamilyMember
    func loadChildren(familyId: String) async throws -> [ChildProfile]
    func sendCheckInRequest(familyId: String, parentId: String, childId: String) async throws
    func createSessionRequest(familyId: String, parentId: String, childId: String, kind: SessionKind) async throws -> SessionRequest
    func updateSession(_ request: SessionRequest) async throws
    func sendSOS(familyId: String, childId: String, location: ConsentLocation?) async throws
    func sendSafetyAlert(familyId: String, childId: String, kind: AlertKind, message: String, location: ConsentLocation?) async throws
    func updateLocationConsent(familyId: String, childId: String, enabled: Bool) async throws
    func updateChildLocation(familyId: String, childId: String, location: ConsentLocation) async throws
    func saveDeviceToken(familyId: String, userId: String, role: FamilyRole, token: String) async throws
    func saveSignalingEnvelope(_ envelope: SignalingEnvelope) async throws
}

final class FirebaseSafetyService: FirebaseServicing {
    private let db = Firestore.firestore()

    func loadSignedInMember(userId: String) async throws -> FamilyMember {
        let query = try await db.collectionGroup("members")
            .whereField("uid", isEqualTo: userId)
            .limit(to: 1)
            .getDocuments()

        guard let document = query.documents.first else {
            throw SafetyError.missingPairing
        }

        return try document.data(as: FamilyMember.self)
    }

    func loadChildren(familyId: String) async throws -> [ChildProfile] {
        let snapshot = try await db.collection("families")
            .document(familyId)
            .collection("children")
            .getDocuments()

        return try snapshot.documents.map { try $0.data(as: ChildProfile.self) }
    }

    func sendCheckInRequest(familyId: String, parentId: String, childId: String) async throws {
        let alert = SafetyAlert(
            id: UUID().uuidString,
            familyId: familyId,
            childId: childId,
            kind: .checkIn,
            createdAt: Date(),
            message: "Parent requested a check-in.",
            location: nil
        )
        try db.collection("families").document(familyId)
            .collection("alerts").document(alert.id)
            .setData(from: alert)
    }

    func createSessionRequest(
        familyId: String,
        parentId: String,
        childId: String,
        kind: SessionKind
    ) async throws -> SessionRequest {
        let request = SessionRequest(
            id: UUID().uuidString,
            familyId: familyId,
            parentId: parentId,
            childId: childId,
            kind: kind,
            status: .requested,
            requestedAt: Date(),
            respondedAt: nil,
            endedAt: nil
        )

        try db.collection("families").document(familyId)
            .collection("sessions").document(request.id)
            .setData(from: request)

        return request
    }

    func updateSession(_ request: SessionRequest) async throws {
        try db.collection("families").document(request.familyId)
            .collection("sessions").document(request.id)
            .setData(from: request, merge: true)
    }

    func sendSOS(familyId: String, childId: String, location: ConsentLocation?) async throws {
        try await sendSafetyAlert(
            familyId: familyId,
            childId: childId,
            kind: .sos,
            message: "SOS requested by child.",
            location: location
        )
    }

    func sendSafetyAlert(
        familyId: String,
        childId: String,
        kind: AlertKind,
        message: String,
        location: ConsentLocation?
    ) async throws {
        let alert = SafetyAlert(
            id: UUID().uuidString,
            familyId: familyId,
            childId: childId,
            kind: kind,
            createdAt: Date(),
            message: message,
            location: location
        )

        try db.collection("families").document(familyId)
            .collection("alerts").document(alert.id)
            .setData(from: alert)
    }

    func updateLocationConsent(familyId: String, childId: String, enabled: Bool) async throws {
        try await db.collection("families").document(familyId)
            .collection("children").document(childId)
            .setData(["locationSharingEnabled": enabled], merge: true)
    }

    func updateChildLocation(familyId: String, childId: String, location: ConsentLocation) async throws {
        try await db.collection("families").document(familyId)
            .collection("children").document(childId)
            .setData([
                "lastKnownLocation": [
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "accuracyMeters": location.accuracyMeters,
                    "capturedAt": Timestamp(date: location.capturedAt)
                ]
            ], merge: true)
    }

    func saveSignalingEnvelope(_ envelope: SignalingEnvelope) async throws {
        try db.collection("families").document(envelope.familyId)
            .collection("sessions").document(envelope.sessionId)
            .collection("signaling").document(envelope.id)
            .setData(from: envelope)
    }

    func saveDeviceToken(familyId: String, userId: String, role: FamilyRole, token: String) async throws {
        try await db.collection("families").document(familyId)
            .collection("devices").document(userId)
            .setData([
                "uid": userId,
                "role": role.rawValue,
                "fcmToken": token,
                "updatedAt": Timestamp(date: Date())
            ], merge: true)
    }
}

enum SafetyError: LocalizedError {
    case missingPairing
    case permissionDenied(String)
    case childApprovalRequired
    case sessionNotVisible

    var errorDescription: String? {
        switch self {
        case .missingPairing:
            return "No paired family account was found."
        case .permissionDenied(let permission):
            return "\(permission) permission is required and must be granted on the child device."
        case .childApprovalRequired:
            return "The child must approve this live session before streaming can start."
        case .sessionNotVisible:
            return "The active session screen must be visible before capture can start."
        }
    }
}
