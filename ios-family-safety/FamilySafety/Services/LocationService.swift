import CoreLocation
import Foundation

protocol LocationServicing {
    func requestWhenInUseAuthorization()
    func currentLocation() async throws -> ConsentLocation
}

final class ConsentLocationService: NSObject, LocationServicing {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<ConsentLocation, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestWhenInUseAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func currentLocation() async throws -> ConsentLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.requestLocation()
        }
    }
}

extension ConsentLocationService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        continuation?.resume(returning: ConsentLocation(location: location))
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}

