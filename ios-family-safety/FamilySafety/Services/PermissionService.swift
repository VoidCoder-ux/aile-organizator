import AVFoundation
import CoreLocation
import Foundation

struct PermissionState: Equatable {
    var microphone: AVAuthorizationStatus
    var camera: AVAuthorizationStatus
    var location: CLAuthorizationStatus
}

protocol PermissionServicing {
    func currentState() -> PermissionState
    func requestMicrophone() async -> AVAuthorizationStatus
    func requestCamera() async -> AVAuthorizationStatus
}

final class IOSPermissionService: PermissionServicing {
    func currentState() -> PermissionState {
        PermissionState(
            microphone: AVCaptureDevice.authorizationStatus(for: .audio),
            camera: AVCaptureDevice.authorizationStatus(for: .video),
            location: CLLocationManager().authorizationStatus
        )
    }

    func requestMicrophone() async -> AVAuthorizationStatus {
        await AVCaptureDevice.requestAccess(for: .audio)
        return AVCaptureDevice.authorizationStatus(for: .audio)
    }

    func requestCamera() async -> AVAuthorizationStatus {
        await AVCaptureDevice.requestAccess(for: .video)
        return AVCaptureDevice.authorizationStatus(for: .video)
    }
}

