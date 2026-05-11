# App Store Review Notes

This app is a family safety app with paired parent and child accounts. It is not designed for hidden monitoring.

## Guideline 2.5.14 Controls

- The child device must accept every live audio or video session request.
- The app requests microphone permission only from a child-facing approval flow.
- The app requests camera permission only for child-approved video sessions.
- The app displays a full-screen active session indicator while microphone or camera capture is active.
- The end session button is always visible during a live session.
- The parent cannot start the child microphone or camera silently.
- There is no background camera capture.
- There is no silent microphone capture.
- There is no hidden recording feature.

## Review Demo Flow

1. Sign in to one device as a parent and another as a child.
2. Pair both accounts into the same family.
3. From the parent device, send an audio or video request.
4. The child device receives a request screen and must accept or decline.
5. If accepted, iOS permission prompts appear only on the child device when needed.
6. The child sees the active session screen before WebRTC capture starts.
7. Tap End Session on the child device to stop capture.

## Data Minimization

The app stores only:

- family member IDs and roles,
- child consent preferences,
- current FCM token per device,
- session request status and timestamps,
- signaling messages for active sessions,
- SOS and safety alert metadata,
- child location only when sharing is enabled or attached to SOS.

No audio or video is stored by this scaffold.

