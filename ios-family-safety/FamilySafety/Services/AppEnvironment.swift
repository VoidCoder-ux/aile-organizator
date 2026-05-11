import Foundation

struct AppEnvironment {
    var auth: AuthServicing
    var firebase: FirebaseServicing
    var permissions: PermissionServicing
    var location: LocationServicing
    var monitor: SafetyMonitoringServicing
    var webRTC: WebRTCSessionControlling
    var notifications: NotificationServicing

    static let live = AppEnvironment(
        auth: FirebaseAuthService(),
        firebase: FirebaseSafetyService(),
        permissions: IOSPermissionService(),
        location: ConsentLocationService(),
        monitor: DeviceSafetyMonitor(),
        webRTC: WebRTCSessionController(),
        notifications: PushNotificationService()
    )
}
