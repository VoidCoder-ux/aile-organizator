import CoreLocation
import Foundation
import UIKit

protocol SafetyMonitoringServicing {
    var onLowBattery: ((Double) -> Void)? { get set }
    var onGeofenceEvent: ((String) -> Void)? { get set }
    func startBatteryMonitoring()
    func stopBatteryMonitoring()
    func startGeofenceMonitoring(zones: [GeofenceZone])
    func stopGeofenceMonitoring()
}

final class DeviceSafetyMonitor: NSObject, SafetyMonitoringServicing {
    var onLowBattery: ((Double) -> Void)?
    var onGeofenceEvent: ((String) -> Void)?

    private let locationManager = CLLocationManager()
    private let lowBatteryThreshold = 0.2
    private var lastLowBatteryAlertAt: Date?

    override init() {
        super.init()
        locationManager.delegate = self
    }

    func startBatteryMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryDidChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
        batteryDidChange()
    }

    func stopBatteryMonitoring() {
        NotificationCenter.default.removeObserver(self, name: UIDevice.batteryLevelDidChangeNotification, object: nil)
        UIDevice.current.isBatteryMonitoringEnabled = false
    }

    func startGeofenceMonitoring(zones: [GeofenceZone]) {
        stopGeofenceMonitoring()
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }

        for zone in zones where zone.enabled {
            let center = CLLocationCoordinate2D(latitude: zone.latitude, longitude: zone.longitude)
            let region = CLCircularRegion(center: center, radius: zone.radiusMeters, identifier: zone.id)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            locationManager.startMonitoring(for: region)
        }
    }

    func stopGeofenceMonitoring() {
        for region in locationManager.monitoredRegions {
            locationManager.stopMonitoring(for: region)
        }
    }

    @objc private func batteryDidChange() {
        let level = Double(UIDevice.current.batteryLevel)
        guard level >= 0, level <= lowBatteryThreshold else { return }
        if let lastLowBatteryAlertAt, Date().timeIntervalSince(lastLowBatteryAlertAt) < 3600 {
            return
        }
        lastLowBatteryAlertAt = Date()
        onLowBattery?(level)
    }
}

extension DeviceSafetyMonitor: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        onGeofenceEvent?("Entered \(region.identifier)")
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        onGeofenceEvent?("Exited \(region.identifier)")
    }
}
