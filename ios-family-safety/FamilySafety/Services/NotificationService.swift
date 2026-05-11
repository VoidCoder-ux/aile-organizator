import FirebaseMessaging
import Foundation
import UIKit
import UserNotifications

protocol NotificationServicing {
    func requestPushAuthorization() async throws
    func currentFCMToken() async throws -> String?
}

final class PushNotificationService: NotificationServicing {
    func requestPushAuthorization() async throws {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else { return }
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func currentFCMToken() async throws -> String? {
        try await Messaging.messaging().token()
    }
}
