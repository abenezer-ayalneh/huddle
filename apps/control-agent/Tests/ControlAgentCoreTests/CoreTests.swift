import CoreGraphics
import XCTest
@testable import ControlAgentCore

final class CoreTests: XCTestCase {
    func testBootstrapRejectsNonLocalHTTPAndAcceptsLocalDev() throws {
        XCTAssertThrowsError(try BootstrapLink.manual(api: "http://example.com", room: "room", sessionID: "session", code: "abcdefgh"))
        let link = try BootstrapLink.manual(api: "http://localhost:3001", room: "room", sessionID: "session", code: "abcdefgh")
        XCTAssertEqual(link.room, "room")
    }

    func testDecoderBoundsAndInputShape() throws {
        let payload = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:input", "sessionId": "session", "sequence": 1,
            "event": ["kind": "key", "action": "down", "code": "KeyA", "modifiers": ["meta"]],
        ])
        let decoded = try ControlPacketDecoder.decode(payload)
        XCTAssertEqual(decoded.sequence, 1)
        XCTAssertEqual(decoded.command, .input(.key(action: .down, code: "KeyA", key: nil, modifiers: [.meta])))
        XCTAssertThrowsError(try ControlPacketDecoder.decode(Data(repeating: 0, count: maximumControlPacketBytes + 1)))
    }

    func testScrollPacketsAndAccumulatorPreserveTrackpadMotion() throws {
        let scroll = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:input", "sessionId": "session", "sequence": 2,
            "event": ["kind": "scroll", "x": 0.25, "y": 0.75, "dx": 0.4, "dy": -0.4],
        ])
        XCTAssertEqual(
            try ControlPacketDecoder.decode(scroll).command,
            .input(.scroll(x: 0.25, y: 0.75, dx: 0.4, dy: -0.4)),
        )

        let outOfBounds = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:input", "sessionId": "session", "sequence": 3,
            "event": ["kind": "scroll", "x": 0.25, "y": 0.75, "dx": 4_097, "dy": 0],
        ])
        XCTAssertThrowsError(try ControlPacketDecoder.decode(outOfBounds))

        var accumulator = ScrollDeltaAccumulator()
        XCTAssertNil(accumulator.consume(browserDX: 0.4, browserDY: -0.4))
        XCTAssertEqual(
            accumulator.consume(browserDX: 0.7, browserDY: -0.7),
            SmoothScrollWheelDelta(vertical: 1, horizontal: -1),
        )
        XCTAssertEqual(
            accumulator.consume(browserDX: -3.25, browserDY: 2.75),
            SmoothScrollWheelDelta(vertical: -2, horizontal: 3),
        )

        accumulator.reset()
        XCTAssertNil(accumulator.consume(browserDX: 0.75, browserDY: 0.75))
        accumulator.reset()
        XCTAssertNil(accumulator.consume(browserDX: 0.5, browserDY: 0.5))
    }

    func testClipboardCommandsAreStrictlyBounded() throws {
        let copy = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-copy", "sessionId": "session", "sequence": 1,
        ])
        XCTAssertEqual(try ControlPacketDecoder.decode(copy).command, .clipboardCopy)

        let paste = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-paste", "sessionId": "session", "sequence": 2, "text": "Hello",
        ])
        XCTAssertEqual(try ControlPacketDecoder.decode(paste).command, .clipboardPaste("Hello"))

        let malformedCopy = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-copy", "sessionId": "session", "sequence": 3, "unexpected": true,
        ])
        XCTAssertThrowsError(try ControlPacketDecoder.decode(malformedCopy))

        let empty = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-paste", "sessionId": "session", "sequence": 3, "text": "",
        ])
        XCTAssertThrowsError(try ControlPacketDecoder.decode(empty))

        let nonText = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-paste", "sessionId": "session", "sequence": 4, "text": ["formatted"],
        ])
        XCTAssertThrowsError(try ControlPacketDecoder.decode(nonText))

        let tooLarge = try JSONSerialization.data(withJSONObject: [
            "v": 1, "type": "remote-control:clipboard-paste", "sessionId": "session", "sequence": 5,
            "text": String(repeating: "x", count: maximumClipboardTextBytes + 1),
        ])
        XCTAssertThrowsError(try ControlPacketDecoder.decode(tooLarge))
    }

    func testGrantGateBindsSenderProjectionAndSequence() throws {
        let due = Date(timeIntervalSinceNow: 1_800)
        let session = BootstrapSession(sessionID: "session", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", renewalDueAt: due)
        let snapshot = GrantSnapshot(room: "room", session: session)
        var gate = GrantGate(bootstrap: snapshot)
        let token = AgentTokenMetadata(role: "control-agent", room: "room", sessionID: "session", sharerIdentity: "sharer", controllerIdentity: "controller", agentIdentity: "control-agent:session")
        let projection = RemoteControlProjection(sessionID: "session", status: "active", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", agentConnected: true, renewalDueAt: due)
        let packet = ControlCommandPacket(sessionID: "session", sequence: 1, command: .input(.move(x: 0.5, y: 0.5)))
        XCTAssertTrue(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "control-agent:session", projection: projection, now: Date()))
        XCTAssertFalse(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "control-agent:session", projection: RemoteControlProjection(sessionID: "session", status: "awaiting-agent", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", agentConnected: false, renewalDueAt: due), now: Date()))
        XCTAssertFalse(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "other-agent", projection: projection, now: Date()))
        guard case .success(let event) = gate.authorize(packet, senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("valid input was rejected")
        }
        XCTAssertEqual(event, .input(.move(x: 0.5, y: 0.5)))
        guard case .failure(let replay) = gate.authorize(packet, senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("replayed input was accepted")
        }
        XCTAssertEqual(replay, .replayedSequence)
        guard case .failure(let sender) = gate.authorize(ControlCommandPacket(sessionID: "session", sequence: 2, command: .clipboardCopy), senderIdentity: "forged", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("forged sender was accepted")
        }
        XCTAssertEqual(sender, .wrongSender)
        guard case .failure(let wrongSession) = gate.authorize(ControlCommandPacket(sessionID: "other-session", sequence: 2, command: .clipboardCopy), senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("wrong session was accepted")
        }
        XCTAssertEqual(wrongSession, .wrongSession)

        let expired = RemoteControlProjection(sessionID: "session", status: "active", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", agentConnected: true, renewalDueAt: Date(timeIntervalSinceNow: -1))
        guard case .failure(let expiry) = gate.authorize(ControlCommandPacket(sessionID: "session", sequence: 2, command: .clipboardPaste("late")), senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: expired, connected: true, now: Date()) else {
            return XCTFail("expired clipboard paste was accepted")
        }
        XCTAssertEqual(expiry, .expired)
        guard case .failure(let disconnected) = gate.authorize(ControlCommandPacket(sessionID: "session", sequence: 2, command: .clipboardCopy), senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: false, now: Date()) else {
            return XCTFail("disconnected clipboard copy was accepted")
        }
        XCTAssertEqual(disconnected, .disconnected)
    }

    func testClipboardSuppressionConsumesOnlyTheExpectedPasteboardChange() {
        var suppression = ClipboardEchoSuppression()
        suppression.recordLocalPasteboardWrite(changeCount: 12)
        XCTAssertFalse(suppression.consumes(changeCount: 11))
        XCTAssertFalse(suppression.consumes(changeCount: 12))

        suppression.recordLocalPasteboardWrite(changeCount: 13)
        XCTAssertTrue(suppression.consumes(changeCount: 13))
        XCTAssertFalse(suppression.consumes(changeCount: 13))
    }

    func testCoordinateAndReleaseState() {
        let geometry = DisplayGeometry(displayID: 1, bounds: CGRect(x: 10, y: 20, width: 100, height: 200))
        // The controller's normalized y comes from browser/video coordinates
        // (top = 0, bottom = 1), which is also the coordinate direction that
        // CGEvent uses for the target display.
        XCTAssertEqual(CoordinateMapper.point(x: 0.5, y: 0, in: geometry), CGPoint(x: 60, y: 20))
        XCTAssertEqual(CoordinateMapper.point(x: 0.5, y: 0.25, in: geometry), CGPoint(x: 60, y: 70))
        XCTAssertEqual(CoordinateMapper.point(x: 0.5, y: 1, in: geometry), CGPoint(x: 60, y: 220))
        var state = InputState()
        state.apply(.button(action: .down, x: 0, y: 0, button: .left))
        state.apply(.key(action: .down, code: "KeyA", key: "a", modifiers: []))
        XCTAssertEqual(state.drainHeldInputs().buttons, [.left])
        XCTAssertEqual(state.heldButtons, [])
        XCTAssertEqual(state.heldKeyCodes, [])
    }

    func testServerTrustIsExactOriginAndStoresNoCredentials() throws {
        let suite = "huddle-control-agent-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        let store = ServerTrustStore(defaults: defaults)
        let origin = URL(string: "https://huddle.example:8443")!
        store.trust(origin)
        XCTAssertTrue(store.isTrusted(origin))
        XCTAssertFalse(store.isTrusted(URL(string: "https://other.example:8443")!))
        XCTAssertEqual(store.trustedOrigins(), ["https://huddle.example:8443"])
        store.forget(origin)
        XCTAssertFalse(store.isTrusted(origin))
        defaults.removePersistentDomain(forName: suite)
    }

    func testRequiredAndAdvisoryReleaseDecisions() throws {
        let notes = URL(string: "https://github.com/example/releases")!
        let artifact = AgentReleaseArtifact(url: URL(string: "https://github.com/example/agent.dmg")!, sha256: String(repeating: "a", count: 64), sizeBytes: 1)
        let manifest = AgentReleaseManifest(
            schemaVersion: 1,
            channel: "beta",
            keyId: "test",
            version: "1.2.0",
            minimumSupportedVersion: "1.1.0",
            minimumMacOS: "13.0",
            releasedAt: "2026-07-23T00:00:00Z",
            releaseNotesUrl: notes,
            downloads: AgentReleaseDownloads(arm64: artifact, x86_64: artifact)
        )
        XCTAssertEqual(AgentReleaseVerifier.decision(currentVersion: "1.0.0", manifest: manifest), .required(version: "1.2.0", notes: notes))
        XCTAssertEqual(AgentReleaseVerifier.decision(currentVersion: "1.1.0", manifest: manifest), .available(version: "1.2.0", notes: notes))
        XCTAssertEqual(AgentReleaseVerifier.decision(currentVersion: "1.2.0", manifest: manifest), .current)
    }
}
