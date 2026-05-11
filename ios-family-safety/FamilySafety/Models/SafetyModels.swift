import Foundation
import CoreLocation

enum FamilyRole: String, Codable, CaseIterable, Identifiable {
    case parent
    case child

    var id: String { rawValue }
}

enum SessionKind: String, Codable, CaseIterable, Identifiable {
    case audio
    case video

    var id: String { rawValue }
    var requiresCamera: Bool { self == .video }
}

enum SessionStatus: String, Codable {
    case requested
    case accepted
    case declined
    case active
    case ended
    case expired
}

enum AlertKind: String, Codable, CaseIterable, Identifiable {
    case sos
    case lowBattery
    case geofence
    case checkIn

    var id: String { rawValue }
}

struct FamilyMember: Codable, Identifiable, Equatable {
    let id: String
    var displayName: String
    var role: FamilyRole
    var familyId: String
}

struct ChildProfile: Codable, Identifiable, Equatable {
    let id: String
    var displayName: String
    var batteryLevel: Double?
    var locationSharingEnabled: Bool
    var lastKnownLocation: ConsentLocation?
}

struct ConsentLocation: Codable, Equatable {
    var latitude: Double
    var longitude: Double
    var accuracyMeters: Double
    var capturedAt: Date

    init(location: CLLocation) {
        latitude = location.coordinate.latitude
        longitude = location.coordinate.longitude
        accuracyMeters = location.horizontalAccuracy
        capturedAt = Date()
    }
}

struct SessionRequest: Codable, Identifiable, Equatable {
    let id: String
    let familyId: String
    let parentId: String
    let childId: String
    let kind: SessionKind
    var status: SessionStatus
    let requestedAt: Date
    var respondedAt: Date?
    var endedAt: Date?

    var isPendingForChild: Bool {
        status == .requested
    }
}

struct SafetyAlert: Codable, Identifiable, Equatable {
    let id: String
    let familyId: String
    let childId: String
    let kind: AlertKind
    let createdAt: Date
    var message: String
    var location: ConsentLocation?
}

struct GeofenceZone: Codable, Identifiable, Equatable {
    let id: String
    let familyId: String
    let childId: String
    var name: String
    var latitude: Double
    var longitude: Double
    var radiusMeters: Double
    var enabled: Bool
}

struct PairingInvite: Codable, Identifiable, Equatable {
    let id: String
    let familyId: String
    let createdBy: String
    let code: String
    let expiresAt: Date
}

struct SignalingEnvelope: Codable, Identifiable, Equatable {
    let id: String
    let familyId: String
    let sessionId: String
    let senderId: String
    let recipientId: String
    let ciphertext: Data
    let nonce: Data
    let sentAt: Date
}
