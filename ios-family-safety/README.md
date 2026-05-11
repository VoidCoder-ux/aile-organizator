# iOS Family Safety

SwiftUI scaffold for a privacy-compliant parent/child family safety app.

This implementation is intentionally consent-first. It does not support hidden surveillance, background camera capture, silent microphone access, or secret recording. Child approval is required for each live audio or video session before WebRTC capture starts.

## Targets

- Parent mode: check-in requests, child-approved live audio/video requests, consent-based location, SOS, low battery, and geofence alerts.
- Child mode: large SOS button, request accept/decline screens, permission education, clear active session screen, and always-visible end session control.

## iOS Dependencies

Add these packages to an Xcode iOS App project and include the `FamilySafety` source folder:

- Firebase iOS SDK: `https://github.com/firebase/firebase-ios-sdk.git`
  - `FirebaseAuth`
  - `FirebaseFirestore`
  - `FirebaseFirestoreSwift` if your Firebase SDK version exposes Codable helpers as a separate product
  - `FirebaseMessaging`
- WebRTC package or binary framework:
  - Preferred for production: audited WebRTC build pinned by your mobile team.
  - The source imports `WebRTC` behind `WebRTCSessionController`; replace the adapter if your package exposes different names.

Required Apple frameworks:

- `SwiftUI`
- `AVFoundation`
- `CoreLocation`
- `UserNotifications`
- `CryptoKit`

## Required Info.plist Keys

Use clear purpose strings. Do not request permissions until the child reaches the explanation screen.

```xml
<key>NSCameraUsageDescription</key>
<string>Used only after the child accepts a parent video request. The child can end the video session at any time.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Used only after the child accepts a parent audio or video request. The child can end the session at any time.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to share the child's location with paired parents only when location sharing is enabled by the child.</string>
```

Do not add background audio/camera modes for surveillance. Location background mode should be avoided unless you have a separate, explicit child-facing consent flow and App Review justification.

## Firebase Setup

1. Create parent and child Firebase Authentication accounts.
2. Store pairings in `families/{familyId}/members/{uid}` with `role` set to `parent` or `child`.
3. Store device FCM tokens in `families/{familyId}/devices/{uid}`.
4. Use Cloud Functions in `Firebase/functions/index.ts` to send notifications for requests and alerts.
5. Apply `Firebase/rules/firestore.rules` as the starting Firestore rules.

## Consent Rules Implemented In Code

- Parent can request audio/video, but cannot start the child device stream.
- Child receives a session request and can accept or decline.
- Camera/microphone permissions are requested only from child-visible screens.
- WebRTC capture starts only after:
  - child accepted the exact session request,
  - required iOS permissions are granted,
  - active session screen is displayed.
- Active session screen includes microphone/camera status and a persistent end button.
- SOS and alerts store minimal event metadata.
- Location sharing has a separate child-controlled consent toggle.

## App Store Review Notes

See `Docs/APP_STORE_REVIEW_NOTES.md` and `Docs/PRIVACY_POLICY.md`.
