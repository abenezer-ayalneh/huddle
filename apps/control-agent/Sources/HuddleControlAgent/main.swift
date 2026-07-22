import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import LiveKit
import SwiftUI
import ControlAgentCore

@MainActor
final class AgentModel: ObservableObject {
    @Published var status = "Waiting for a Huddle Remote Control link…"
    @Published var error: String?
    @Published var descriptor: BootstrapDescriptor?
    @Published var session: BootstrapSession?
    @Published var connected = false
    @Published var screenPublished = false
    @Published var screenPermission = CGPreflightScreenCaptureAccess()
    @Published var accessibilityPermission = AXIsProcessTrusted()

    private var agent: LiveKitAgent?

    func accept(_ descriptor: BootstrapDescriptor) {
        self.descriptor = descriptor
        error = nil
        status = "Redeeming one-time Control Agent code…"
        Task { await connect(descriptor) }
    }

    func refreshPermissions() {
        screenPermission = CGPreflightScreenCaptureAccess()
        accessibilityPermission = AXIsProcessTrusted()
    }

    func requestPermissions() {
        if !screenPermission { screenPermission = CGRequestScreenCaptureAccess() }
        if !accessibilityPermission {
            // The C global is imported as mutable shared state under Swift 6
            // strict concurrency. This is the documented Accessibility key.
            accessibilityPermission = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary)
        }
        refreshPermissions()
        if let agent, screenPermission { Task { await agent.publishScreenIfNeeded() } }
    }

    func stop() {
        Task { await agent?.stop() }
        agent = nil
        connected = false
        screenPublished = false
        session = nil
        status = "Control Agent stopped."
    }

    private func connect(_ descriptor: BootstrapDescriptor) async {
        do {
            let response = try await BootstrapClient.redeem(descriptor)
            guard response.room == descriptor.room, response.session.sessionID == descriptor.sessionID,
                  response.session.agentIdentity.hasPrefix("control-agent:")
            else { throw AgentError.invalidServerResponse }
            session = response.session
            let next = LiveKitAgent(model: self, descriptor: descriptor, response: response)
            agent = next
            try await next.connect()
            connected = true
            status = "Connected to \(response.room). Waiting for the server grant and Screen Recording permission…"
        } catch let caught {
            error = caught.localizedDescription
            status = "Could not start Control Agent."
        }
    }

    fileprivate func updateConnection(_ isConnected: Bool, screen: Bool, message: String) {
        connected = isConnected
        screenPublished = screen
        status = message
    }
}

private enum AgentError: LocalizedError {
    case invalidServerResponse
    var errorDescription: String? { "The server returned an invalid or mismatched Control Agent grant." }
}

private enum BootstrapClient {
    static func redeem(_ descriptor: BootstrapDescriptor) async throws -> BootstrapResponse {
        let endpoint = descriptor.apiOrigin.appendingPathComponent("rooms").appendingPathComponent(descriptor.room)
            .appendingPathComponent("remote-control").appendingPathComponent(descriptor.sessionID).appendingPathComponent("helper-token")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["bootstrapCode": descriptor.bootstrapCode])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw NSError(domain: "HuddleControlAgent", code: 1, userInfo: [NSLocalizedDescriptionKey: "The one-time Control Agent code was rejected or expired."])
        }
        return try JSONDecoder().decode(BootstrapResponse.self, from: data)
    }
}

private actor LiveKitAgent {
    private weak var model: AgentModel?
    private let descriptor: BootstrapDescriptor
    private let response: BootstrapResponse
    private let room: Room
    private var gate: GrantGate
    private var projection: RemoteControlProjection?
    private var tokenMetadata: AgentTokenMetadata?
    private var input = InputInjector()
    private var screenPublished = false
    private var stopping = false

    init(model: AgentModel, descriptor: BootstrapDescriptor, response: BootstrapResponse) {
        self.model = model
        self.descriptor = descriptor
        self.response = response
        room = Room()
        gate = GrantGate(bootstrap: GrantSnapshot(room: descriptor.room, session: response.session))
    }

    func connect() async throws {
        room.add(delegate: self)
        try await room.connect(url: response.livekitURL, token: response.token)
        tokenMetadata = decodeMetadata(room.localParticipant.metadata)
        guard gate.hasValidTokenMetadata(tokenMetadata, localAgentIdentity: response.session.agentIdentity) else {
            await room.disconnect()
            throw AgentError.invalidServerResponse
        }
        await metadataChanged(room.metadata)
    }

    func publishScreenIfNeeded() async {
        guard !screenPublished,
              gate.canPublishDesktop(
                  tokenMetadata: tokenMetadata,
                  localAgentIdentity: response.session.agentIdentity,
                  projection: projection,
                  now: Date(),
              )
        else { return }
        do {
            try await room.localParticipant.setScreenShare(enabled: true)
            screenPublished = true
            await model?.updateConnection(true, screen: true, message: "Desktop is visible to the Huddle room.")
        } catch {
            await model?.updateConnection(true, screen: false, message: "Connected, but Screen Recording permission is required.")
        }
    }

    func stop() async {
        stopping = true
        input.releaseAll()
        _ = try? await room.localParticipant.setScreenShare(enabled: false)
        await room.disconnect()
    }

    private func metadataChanged(_ metadata: String?) async {
        guard let data = metadata?.data(using: .utf8), let envelope = try? JSONDecoder().decode(RoomMetadataEnvelope.self, from: data) else {
            projection = nil
            await revokeGrant(message: "Remote Control is no longer authorized for this room.")
            return
        }
        projection = envelope.remoteControl
        guard gate.canPublishDesktop(
            tokenMetadata: tokenMetadata,
            localAgentIdentity: response.session.agentIdentity,
            projection: projection,
            now: Date(),
        ) else {
            await revokeGrant(message: "Remote Control is waiting for the server grant or has ended.")
            return
        }
        await publishScreenIfNeeded()
    }

    private func decodeMetadata(_ metadata: String?) -> AgentTokenMetadata? {
        guard let data = metadata?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(AgentTokenMetadata.self, from: data)
    }

    private func revokeGrant(message: String) async {
        input.releaseAll()
        if screenPublished {
            _ = try? await room.localParticipant.setScreenShare(enabled: false)
            screenPublished = false
        }
        await model?.updateConnection(true, screen: false, message: message)
    }

    private func receive(_ data: Data, sender: String?) async {
        guard let sender else { return }
        guard let packet = try? ControlPacketDecoder.decode(data) else { return }
        // The actor serializes packets; the gate itself is the server-grant
        // projection check and never trusts a claimed sender in JSON.
        var mutable = gate
        let result = mutable.authorize(
            packet,
            senderIdentity: sender,
            localAgentIdentity: response.session.agentIdentity,
            tokenMetadata: tokenMetadata,
            projection: projection,
            connected: true,
            now: Date(),
        )
        gate = mutable
        if case .success(let event) = result { input.apply(event, geometry: currentGeometry()) }
    }

    private func currentGeometry() -> DisplayGeometry {
        let screen = NSScreen.main?.frame ?? .zero
        return DisplayGeometry(displayID: 0, bounds: screen)
    }
}

extension LiveKitAgent: RoomDelegate {
    nonisolated func room(_ room: Room, didUpdateMetadata metadata: String?) { Task { await metadataChanged(metadata) } }
    nonisolated func room(_ room: Room, participant: RemoteParticipant?, didReceiveData data: Data, forTopic topic: String, encryptionType: EncryptionType) {
        guard topic == remoteControlTopic else { return }
        let sender = participant?.identity?.stringValue
        Task { await receive(data, sender: sender) }
    }
    nonisolated func room(_ room: Room, participantDidDisconnect participant: RemoteParticipant) {
        let identity = participant.identity?.stringValue
        Task { await participantDisconnected(identity) }
    }
    nonisolated func room(_ room: Room, didFailToConnectWithError error: LiveKitError?) { Task { await connectionFailed() } }
    nonisolated func room(_ room: Room, didDisconnectWithError error: LiveKitError?) { Task { await connectionLost() } }

    private func participantDisconnected(_ identity: String?) async {
        if identity == response.session.controllerIdentity { input.releaseAll() }
    }

    private func connectionFailed() async {
        await model?.updateConnection(false, screen: false, message: "LiveKit could not connect.")
    }

    private func connectionLost() async {
        input.releaseAll()
        screenPublished = false
        await model?.updateConnection(false, screen: false, message: stopping ? "Control Agent stopped." : "Disconnected from the Huddle room.")
    }
}

private struct InputInjector {
    private var state = InputState()

    mutating func apply(_ event: ControlInputEvent, geometry: DisplayGeometry) {
        switch event {
        case let .move(x, y): postMouse(.mouseMoved, x: x, y: y, button: .left, geometry: geometry)
        case let .button(action, x, y, button):
            postMouse(action == .down ? mouseDown(button) : mouseUp(button), x: x, y: y, button: button, geometry: geometry)
            state.apply(event)
        case let .scroll(_, _, dx, dy):
            let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: Int32(dy), wheel2: Int32(dx), wheel3: 0)
            event?.post(tap: .cghidEventTap)
        case let .key(action, code, _, modifiers):
            guard let keyCode = KeyboardCodeMap.virtualKey(for: code) else { return }
            let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: action == .down)
            event?.flags = modifiers.reduce(CGEventFlags()) { flags, modifier in flags.union(flag(for: modifier)) }
            event?.post(tap: .cghidEventTap)
            state.apply(eventFromKey(action, code: code, modifiers: modifiers))
        case .releaseAll: releaseAll()
        }
    }

    mutating func releaseAll() {
        let held = state.drainHeldInputs()
        let point = NSEvent.mouseLocation
        for button in held.buttons { post(mouseUp(button), point: point, button: button) }
        for code in held.keyCodes where KeyboardCodeMap.virtualKey(for: code) != nil {
            CGEvent(keyboardEventSource: nil, virtualKey: KeyboardCodeMap.virtualKey(for: code)!, keyDown: false)?.post(tap: .cghidEventTap)
        }
    }

    private func postMouse(_ type: CGEventType, x: Double, y: Double, button: MouseButton, geometry: DisplayGeometry) {
        guard let point = CoordinateMapper.point(x: x, y: y, in: geometry) else { return }
        post(type, point: point, button: button)
    }
    private func post(_ type: CGEventType, point: CGPoint, button: MouseButton) { CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: button == .right ? .right : button == .middle ? .center : .left)?.post(tap: .cghidEventTap) }
    private func mouseDown(_ button: MouseButton) -> CGEventType { button == .right ? .rightMouseDown : button == .middle ? .otherMouseDown : .leftMouseDown }
    private func mouseUp(_ button: MouseButton) -> CGEventType { button == .right ? .rightMouseUp : button == .middle ? .otherMouseUp : .leftMouseUp }
    private func flag(for modifier: KeyModifier) -> CGEventFlags { modifier == .shift ? .maskShift : modifier == .ctrl ? .maskControl : modifier == .alt ? .maskAlternate : .maskCommand }
    private func eventFromKey(_ action: KeyAction, code: String, modifiers: Set<KeyModifier>) -> ControlInputEvent { .key(action: action, code: code, key: nil, modifiers: modifiers) }
}

struct AgentView: View {
    @ObservedObject var model: AgentModel
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Huddle Control Agent").font(.title2).bold()
            Text(model.status).foregroundStyle(.secondary)
            if let session = model.session { Text("Room \(session.sessionID) · Sharer \(session.sharerName) · Controller \(session.controllerName)").font(.callout) }
            Divider()
            permissionRow("Screen Recording", granted: model.screenPermission)
            permissionRow("Accessibility", granted: model.accessibilityPermission)
            HStack {
                Button("Open Permission Settings") { model.requestPermissions() }
                Button("Refresh") { model.refreshPermissions() }
                Spacer()
                Button("Stop", role: .destructive) { model.stop() }.disabled(!model.connected)
            }
            if let error = model.error { Text(error).foregroundStyle(.red).font(.callout) }
        }
        .padding(24)
        .frame(minWidth: 430)
        .onAppear { model.refreshPermissions() }
    }

    private func permissionRow(_ name: String, granted: Bool) -> some View {
        Label(granted ? "\(name) granted" : "\(name) required", systemImage: granted ? "checkmark.circle.fill" : "exclamationmark.triangle.fill").foregroundStyle(granted ? .green : .orange)
    }
}

@main
struct HuddleControlAgentApp: App {
    @StateObject private var model = AgentModel()
    var body: some Scene {
        WindowGroup { AgentView(model: model).onOpenURL { url in
            do { model.accept(try BootstrapLink.parse(url)) } catch { model.error = error.localizedDescription }
        }.task {
            if let descriptor = try? BootstrapLink.commandLine(arguments: CommandLine.arguments) { model.accept(descriptor) }
        } }
    }
}
