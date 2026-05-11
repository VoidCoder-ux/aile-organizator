# Privacy Policy

This family safety app is built around explicit consent and paired family accounts.

## Information We Collect

- Account identifier from Firebase Authentication.
- Family pairing role, such as parent or child.
- Device notification token for Firebase Cloud Messaging.
- Safety alert metadata, such as SOS, low battery, or geofence alert type.
- Location only when the child enables location sharing or sends SOS.
- Live session status and encrypted signaling metadata.

## Live Audio and Video

Live audio and video are never started silently. A parent can request a live session, but the child must approve the specific request before microphone or camera capture begins.

The child device shows a clear active session screen while microphone or camera capture is active. The child can end the session at any time.

The app does not store audio or video recordings.

## Location

Child location is shared only with paired parents and only when the child enables location sharing or sends SOS. The child can turn off location sharing in the app.

## Data Retention

Safety alerts and session metadata should be retained only as long as needed for family safety history. Production deployments should configure automatic deletion windows for old alerts, signaling messages, and inactive sessions.

## Data Sharing

Data is shared only between paired family accounts and the backend services required to operate the app, including Firebase Authentication, Firestore, and Firebase Cloud Messaging.

## Consent Withdrawal

The child can decline any live session request, end an active session, deny microphone/camera permission in iOS, and disable location sharing.

