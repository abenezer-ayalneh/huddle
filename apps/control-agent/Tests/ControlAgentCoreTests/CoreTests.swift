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
        XCTAssertThrowsError(try ControlPacketDecoder.decode(Data(repeating: 0, count: maximumControlPacketBytes + 1)))
    }

    func testGrantGateBindsSenderProjectionAndSequence() throws {
        let due = Date(timeIntervalSinceNow: 1_800)
        let session = BootstrapSession(sessionID: "session", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", renewalDueAt: due)
        let snapshot = GrantSnapshot(room: "room", session: session)
        var gate = GrantGate(bootstrap: snapshot)
        let token = AgentTokenMetadata(role: "control-agent", room: "room", sessionID: "session", sharerIdentity: "sharer", controllerIdentity: "controller", agentIdentity: "control-agent:session")
        let projection = RemoteControlProjection(sessionID: "session", status: "active", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", agentConnected: true, renewalDueAt: due)
        let packet = ControlInputPacket(sessionID: "session", sequence: 1, event: .move(x: 0.5, y: 0.5))
        XCTAssertTrue(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "control-agent:session", projection: projection, now: Date()))
        XCTAssertFalse(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "control-agent:session", projection: RemoteControlProjection(sessionID: "session", status: "awaiting-agent", sharerIdentity: "sharer", sharerName: "Ada", controllerIdentity: "controller", controllerName: "Bo", agentIdentity: "control-agent:session", agentConnected: false, renewalDueAt: due), now: Date()))
        XCTAssertFalse(gate.canPublishDesktop(tokenMetadata: token, localAgentIdentity: "other-agent", projection: projection, now: Date()))
        guard case .success(let event) = gate.authorize(packet, senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("valid input was rejected")
        }
        XCTAssertEqual(event, .move(x: 0.5, y: 0.5))
        guard case .failure(let replay) = gate.authorize(packet, senderIdentity: "controller", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("replayed input was accepted")
        }
        XCTAssertEqual(replay, .replayedSequence)
        guard case .failure(let sender) = gate.authorize(ControlInputPacket(sessionID: "session", sequence: 2, event: .move(x: 0.5, y: 0.5)), senderIdentity: "forged", localAgentIdentity: "control-agent:session", tokenMetadata: token, projection: projection, connected: true, now: Date()) else {
            return XCTFail("forged sender was accepted")
        }
        XCTAssertEqual(sender, .wrongSender)
    }

    func testCoordinateAndReleaseState() {
        let geometry = DisplayGeometry(displayID: 1, bounds: CGRect(x: 10, y: 20, width: 100, height: 200))
        XCTAssertEqual(CoordinateMapper.point(x: 0.5, y: 0.25, in: geometry), CGPoint(x: 60, y: 170))
        var state = InputState()
        state.apply(.button(action: .down, x: 0, y: 0, button: .left))
        state.apply(.key(action: .down, code: "KeyA", key: "a", modifiers: []))
        XCTAssertEqual(state.drainHeldInputs().buttons, [.left])
        XCTAssertEqual(state.heldButtons, [])
        XCTAssertEqual(state.heldKeyCodes, [])
    }
}
