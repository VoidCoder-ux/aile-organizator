import AVFoundation
import Foundation

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var member: FamilyMember?
    @Published private(set) var children: [ChildProfile] = []
    @Published var selectedRole: FamilyRole = .parent
    @Published var pendingSessionRequest: SessionRequest?
    @Published var activeSessionRequest: SessionRequest?
    @Published var activeSessionScreenVisible = false
    @Published var locationSharingEnabled = false
    @Published var permissionState: PermissionState
    @Published var errorMessage: String?
    @Published var statusMessage: String?
    @Published var isSignedIn = false

    private let environment: AppEnvironment
    private var fcmTokenObserver: NSObjectProtocol?

    init(environment: AppEnvironment) {
        self.environment = environment
        permissionState = environment.permissions.currentState()
        fcmTokenObserver = NotificationCenter.default.addObserver(
            forName: .fcmTokenDidChange,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let token = notification.object as? String else { return }
            Task { @MainActor in
                await self?.saveDeviceToken(token)
            }
        }
    }

    deinit {
        if let fcmTokenObserver {
            NotificationCenter.default.removeObserver(fcmTokenObserver)
        }
    }

    func bootstrap() async {
        do {
            try await environment.notifications.requestPushAuthorization()
            if let userId = environment.auth.currentUserId {
                isSignedIn = true
                member = try await environment.firebase.loadSignedInMember(userId: userId)
                selectedRole = member?.role ?? .parent
                if let familyId = member?.familyId {
                    children = try await environment.firebase.loadChildren(familyId: familyId)
                }
                if let token = try await environment.notifications.currentFCMToken() {
                    await saveDeviceToken(token)
                }
                configureChildMonitorsIfNeeded()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signIn(email: String, password: String) async {
        do {
            try await environment.auth.signIn(email: email, password: password)
            errorMessage = nil
            statusMessage = "Signed in."
            await bootstrap()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendCheckIn(to child: ChildProfile) async {
        guard let member else { return }
        do {
            try await environment.firebase.sendCheckInRequest(
                familyId: member.familyId,
                parentId: member.id,
                childId: child.id
            )
            statusMessage = "Check-in request sent."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func requestLiveSession(kind: SessionKind, child: ChildProfile) async {
        guard let member else { return }
        do {
            let request = try await environment.firebase.createSessionRequest(
                familyId: member.familyId,
                parentId: member.id,
                childId: child.id,
                kind: kind
            )
            statusMessage = "\(kind.rawValue.capitalized) request sent. Waiting for child approval."
            pendingSessionRequest = request
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func childReceivesDemoRequest(kind: SessionKind) {
        guard let member else { return }
        pendingSessionRequest = SessionRequest(
            id: UUID().uuidString,
            familyId: member.familyId,
            parentId: "paired-parent",
            childId: member.id,
            kind: kind,
            status: .requested,
            requestedAt: Date(),
            respondedAt: nil,
            endedAt: nil
        )
    }

    func acceptPendingSession() async {
        guard var request = pendingSessionRequest else { return }
        do {
            if request.kind == .audio || request.kind == .video {
                let microphone = await environment.permissions.requestMicrophone()
                permissionState = environment.permissions.currentState()
                guard microphone == .authorized else {
                    throw SafetyError.permissionDenied("Microphone")
                }
            }

            if request.kind.requiresCamera {
                let camera = await environment.permissions.requestCamera()
                permissionState = environment.permissions.currentState()
                guard camera == .authorized else {
                    throw SafetyError.permissionDenied("Camera")
                }
            }

            request.status = .accepted
            request.respondedAt = Date()
            try await environment.firebase.updateSession(request)
            pendingSessionRequest = nil
            activeSessionRequest = request
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func declinePendingSession() async {
        guard var request = pendingSessionRequest else { return }
        do {
            request.status = .declined
            request.respondedAt = Date()
            try await environment.firebase.updateSession(request)
            pendingSessionRequest = nil
            statusMessage = "Request declined."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startVisibleApprovedSession() async {
        guard var request = activeSessionRequest else { return }
        do {
            activeSessionScreenVisible = true
            try await environment.webRTC.startApprovedSession(request, activeScreenVisible: activeSessionScreenVisible)
            request.status = .active
            try await environment.firebase.updateSession(request)
            activeSessionRequest = request
        } catch {
            activeSessionScreenVisible = false
            errorMessage = error.localizedDescription
        }
    }

    func endActiveSession() async {
        guard var request = activeSessionRequest else {
            await environment.webRTC.endSession()
            return
        }

        await environment.webRTC.endSession()
        request.status = .ended
        request.endedAt = Date()
        try? await environment.firebase.updateSession(request)
        activeSessionRequest = nil
        activeSessionScreenVisible = false
        statusMessage = "Session ended."
    }

    func sendSOS() async {
        guard let member else { return }
        do {
            let location = try? await environment.location.currentLocation()
            try await environment.firebase.sendSOS(
                familyId: member.familyId,
                childId: member.id,
                location: location
            )
            statusMessage = "SOS alert sent to paired parents."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setLocationSharing(enabled: Bool) async {
        guard let member else { return }
        do {
            locationSharingEnabled = enabled
            if enabled {
                environment.location.requestWhenInUseAuthorization()
            }
            try await environment.firebase.updateLocationConsent(
                familyId: member.familyId,
                childId: member.id,
                enabled: enabled
            )
            statusMessage = enabled ? "Location sharing enabled." : "Location sharing disabled."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func configureChildMonitorsIfNeeded() {
        guard member?.role == .child, let member else { return }

        environment.monitor.onLowBattery = { [weak self] batteryLevel in
            Task { @MainActor in
                try? await self?.environment.firebase.sendSafetyAlert(
                    familyId: member.familyId,
                    childId: member.id,
                    kind: .lowBattery,
                    message: "Child device battery is \(Int(batteryLevel * 100))%.",
                    location: nil
                )
            }
        }

        environment.monitor.onGeofenceEvent = { [weak self] event in
            Task { @MainActor in
                guard self?.locationSharingEnabled == true else { return }
                let location = try? await self?.environment.location.currentLocation()
                try? await self?.environment.firebase.sendSafetyAlert(
                    familyId: member.familyId,
                    childId: member.id,
                    kind: .geofence,
                    message: event,
                    location: location
                )
            }
        }

        environment.monitor.startBatteryMonitoring()
    }

    private func saveDeviceToken(_ token: String) async {
        guard let member else { return }
        try? await environment.firebase.saveDeviceToken(
            familyId: member.familyId,
            userId: member.id,
            role: member.role,
            token: token
        )
    }
}
