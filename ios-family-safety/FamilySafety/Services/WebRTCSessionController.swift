import AVFoundation
import Foundation
import SwiftUI
import WebRTC

protocol WebRTCSessionControlling {
    var activeSession: ActiveWebRTCSession? { get }
    func prepare(kind: SessionKind) async throws
    func startApprovedSession(_ request: SessionRequest, activeScreenVisible: Bool) async throws
    func endSession() async
}

struct ActiveWebRTCSession: Equatable {
    let sessionId: String
    let kind: SessionKind
    let startedAt: Date
}

final class WebRTCSessionController: ObservableObject, WebRTCSessionControlling {
    @Published private(set) var activeSession: ActiveWebRTCSession?

    private var peerConnectionFactory: RTCPeerConnectionFactory?
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoTrack: RTCVideoTrack?
    private var videoCapturer: RTCCameraVideoCapturer?

    func prepare(kind: SessionKind) async throws {
        if peerConnectionFactory == nil {
            RTCInitializeSSL()
            peerConnectionFactory = RTCPeerConnectionFactory()
        }

        if kind == .video {
            _ = RTCCameraVideoCapturer.captureDevices()
        }
    }

    func startApprovedSession(_ request: SessionRequest, activeScreenVisible: Bool) async throws {
        guard request.status == .accepted else {
            throw SafetyError.childApprovalRequired
        }
        guard activeScreenVisible else {
            throw SafetyError.sessionNotVisible
        }

        try await prepare(kind: request.kind)

        guard let factory = peerConnectionFactory else { return }
        let audioSource = factory.audioSource(with: nil)
        localAudioTrack = factory.audioTrack(with: audioSource, trackId: "child-audio-\(request.id)")

        if request.kind == .video {
            let videoSource = factory.videoSource()
            let capturer = RTCCameraVideoCapturer(delegate: videoSource)
            videoCapturer = capturer
            localVideoTrack = factory.videoTrack(with: videoSource, trackId: "child-video-\(request.id)")
            try await startFrontCamera(capturer: capturer)
        }

        activeSession = ActiveWebRTCSession(sessionId: request.id, kind: request.kind, startedAt: Date())
    }

    func endSession() async {
        videoCapturer?.stopCapture()
        videoCapturer = nil
        localVideoTrack = nil
        localAudioTrack = nil
        activeSession = nil
    }

    private func startFrontCamera(capturer: RTCCameraVideoCapturer) async throws {
        guard let device = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front }),
              let format = RTCCameraVideoCapturer.supportedFormats(for: device).last,
              let fps = format.videoSupportedFrameRateRanges.map({ $0.maxFrameRate }).max() else {
            return
        }

        try await withCheckedThrowingContinuation { continuation in
            capturer.startCapture(with: device, format: format, fps: Int(fps)) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
}

