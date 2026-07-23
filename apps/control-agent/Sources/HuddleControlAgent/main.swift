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
    @Published var updateNotice: String?
    @Published var descriptor: BootstrapDescriptor?
    @Published var session: BootstrapSession?
    @Published var connected = false
    @Published var screenPublished = false
    @Published var screenPermission = CGPreflightScreenCaptureAccess()
    @Published var accessibilityPermission = AXIsProcessTrusted()
    @Published var displays: [DisplayOption] = []
    @Published var selectedDisplayID: UInt32?
    @Published var pendingTrustOrigin: String?
    @Published var manualLink = ""

    private var agent: LiveKitAgent?
    private var pendingDescriptor: BootstrapDescriptor?
    private let releaseChecker = AgentReleaseChecker()

    var appVersion: String { (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0.0" }
    var releaseChannelURL: URL { URL(string: (Bundle.main.object(forInfoDictionaryKey: "ControlAgentReleaseChannelURL") as? String) ?? "https://github.com/abenezer-ayalneh/huddle/releases/download/control-agent-beta")! }
    var updatePublicKey: String { (Bundle.main.object(forInfoDictionaryKey: "ControlAgentUpdatePublicKey") as? String) ?? "" }

    func accept(_ descriptor: BootstrapDescriptor) {
        guard agent == nil else {
            error = "Stop the current Control Agent session before opening another link."
            return
        }
        self.descriptor = descriptor
        pendingDescriptor = descriptor
        error = nil
        status = "Checking this Huddle server and release…"
        Task { await begin(descriptor) }
    }

    func submitManualLink() {
        do {
            guard let url = URL(string: manualLink.trimmingCharacters(in: .whitespacesAndNewlines)) else { throw BootstrapLinkError.invalidAction }
            let descriptor = try BootstrapLink.parse(url)
            manualLink = ""
            accept(descriptor)
        } catch let caught {
            error = caught.localizedDescription
        }
    }

    func confirmServerTrust() {
        guard let descriptor else { return }
        ServerTrustStore.shared.trust(descriptor.apiOrigin)
        pendingTrustOrigin = nil
        status = "Redeeming one-time Control Agent code…"
        Task { await connect(descriptor) }
    }

    func forgetTrustedServers() {
        for origin in ServerTrustStore.shared.trustedOrigins() {
            if let url = URL(string: origin) { ServerTrustStore.shared.forget(url) }
        }
        status = "Saved server trust was cleared."
    }

    func copyDiagnostics() {
        let os = ProcessInfo.processInfo.operatingSystemVersion
        #if arch(arm64)
        let architecture = "arm64"
        #elseif arch(x86_64)
        let architecture = "x86_64"
        #else
        let architecture = "unknown"
        #endif
        let summary = [
            "Huddle Control Agent diagnostics",
            "Agent version: \(appVersion)",
            "macOS: \(os.majorVersion).\(os.minorVersion).\(os.patchVersion)",
            "Architecture: \(architecture)",
            "Screen Recording: \(screenPermission ? "granted" : "missing")",
            "Accessibility: \(accessibilityPermission ? "granted" : "missing")",
            "Connected: \(connected ? "yes" : "no")",
            "Screen published: \(screenPublished ? "yes" : "no")",
        ].joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(summary, forType: .string)
        status = "Sanitized diagnostics copied. Paste them into the beta issue form."
    }

    func startRemoteControl() {
        guard let selectedDisplayID, let agent else { return }
        Task { await agent.startScreen(displayID: selectedDisplayID) }
    }

    private func begin(_ descriptor: BootstrapDescriptor) async {
        switch await releaseChecker.check(currentVersion: appVersion, channelURL: releaseChannelURL, publicKeyBase64: updatePublicKey) {
        case let .required(version, notes):
            updateNotice = "Update required before Remote Control can start (version \(version))."
            error = "Install the required Control Agent update, then return to Huddle."
            NSWorkspace.shared.open(notes)
            return
        case let .available(version, notes):
            updateNotice = "A newer Control Agent (\(version)) is available."
            NSWorkspace.shared.open(notes)
        case .current, .unavailable:
            break
        }

        guard ServerTrustStore.shared.isTrusted(descriptor.apiOrigin) else {
            pendingTrustOrigin = ServerTrustStore.shared.origin(for: descriptor.apiOrigin)
            status = "Confirm the Huddle server before continuing."
            return
        }
        status = "Redeeming one-time Control Agent code…"
        await connect(descriptor)
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
    }

    func stop() {
        Task { await agent?.stop() }
        agent = nil
        connected = false
        screenPublished = false
        session = nil
        displays = []
        selectedDisplayID = nil
        pendingDescriptor = nil
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
            status = "Connected to \(response.room). Choose a display, then start Remote Control."
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

    fileprivate func setDisplays(_ next: [DisplayOption]) {
        displays = next
        if selectedDisplayID == nil { selectedDisplayID = next.first?.id }
    }
}

struct DisplayOption: Identifiable, Equatable, Sendable {
    let id: UInt32
    let title: String
    let dimensions: String
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
    private var screenPublication: LocalTrackPublication?
    private var selectedDisplayID: UInt32?
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
        await model?.setDisplays(await availableDisplays())
    }

    func startScreen(displayID: UInt32) async {
        guard !screenPublished,
              gate.canPublishDesktop(
                  tokenMetadata: tokenMetadata,
                  localAgentIdentity: response.session.agentIdentity,
                  projection: projection,
                  now: Date(),
              )
        else { return }
        do {
            let sources = try await MacOSScreenCapturer.sources(for: .display)
            guard let source = sources.compactMap({ $0 as? MacOSDisplay }).first(where: { $0.displayID == displayID }) else {
                await model?.updateConnection(true, screen: false, message: "That display is no longer available. Refresh the display list.")
                return
            }
            let track = LocalVideoTrack.createMacOSScreenShareTrack(source: source, options: ScreenShareCaptureOptions(showCursor: true, appAudio: false))
            screenPublication = try await room.localParticipant.publish(videoTrack: track)
            selectedDisplayID = displayID
            screenPublished = true
            await model?.updateConnection(true, screen: true, message: "Desktop is visible to the Huddle room.")
        } catch {
            await model?.updateConnection(true, screen: false, message: "Connected, but Screen Recording permission is required.")
        }
    }

    private func availableDisplays() async -> [DisplayOption] {
        guard let sources = try? await MacOSScreenCapturer.sources(for: .display) else { return [] }
        return sources.compactMap { $0 as? MacOSDisplay }.enumerated().map { index, display in
            DisplayOption(id: display.displayID, title: "Display \(index + 1)", dimensions: "\(display.width)×\(display.height)")
        }
    }

    func stop() async {
        stopping = true
        input.releaseAll()
        if let screenPublication { _ = try? await room.localParticipant.unpublish(publication: screenPublication) }
        screenPublication = nil
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
        if !screenPublished { await model?.updateConnection(true, screen: false, message: "Choose a display, then start Remote Control.") }
    }

    private func decodeMetadata(_ metadata: String?) -> AgentTokenMetadata? {
        guard let data = metadata?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(AgentTokenMetadata.self, from: data)
    }

    private func revokeGrant(message: String) async {
        input.releaseAll()
        if screenPublished {
            if let screenPublication { _ = try? await room.localParticipant.unpublish(publication: screenPublication) }
            screenPublication = nil
            screenPublished = false
        }
        await model?.updateConnection(true, screen: false, message: message)
    }

    private func receive(_ data: Data, sender: String?) async {
        guard screenPublished else { return }
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
        // CGDisplayBounds and CGEvent share Quartz's global coordinate space.
        // NSScreen.frame is AppKit-space and can be inverted/offset on a
        // multi-display desktop.
        let displayID = selectedDisplayID ?? CGMainDisplayID()
        return DisplayGeometry(displayID: displayID, bounds: CGDisplayBounds(displayID))
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
            if let updateNotice = model.updateNotice { Label(updateNotice, systemImage: "arrow.down.circle").foregroundStyle(.orange).font(.callout) }
            if let origin = model.pendingTrustOrigin {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Trust this Huddle server?").font(.headline)
                    Text(origin).font(.body.monospaced()).textSelection(.enabled)
                    Text("The agent remembers only this server origin. It does not save the room or one-time link.").font(.caption).foregroundStyle(.secondary)
                    Button("Trust & Continue") { model.confirmServerTrust() }.buttonStyle(.borderedProminent)
                }
                .padding(12)
                .background(.yellow.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
            Divider()
            permissionRow("Screen Recording", granted: model.screenPermission)
            permissionRow("Accessibility", granted: model.accessibilityPermission)
            HStack {
                Button("Prepare for Remote Control") { model.requestPermissions() }
                Button("Refresh") { model.refreshPermissions() }
                Spacer()
                Button("Stop", role: .destructive) { model.stop() }.disabled(!model.connected)
            }
            if !model.displays.isEmpty && model.session != nil && !model.screenPublished {
                Divider()
                Text("Choose the display to share").font(.headline)
                Picker("Display", selection: Binding(get: { model.selectedDisplayID ?? model.displays[0].id }, set: { model.selectedDisplayID = $0 })) {
                    ForEach(model.displays) { display in
                        Text("\(display.title) · \(display.dimensions)").tag(display.id)
                    }
                }
                Button("Start Remote Control") { model.startRemoteControl() }.buttonStyle(.borderedProminent).disabled(!model.screenPermission || !model.accessibilityPermission || model.pendingTrustOrigin != nil)
            }
            Divider()
            Text("Manual launch fallback").font(.headline)
            Text("Paste the complete huddle-control:// link from the Huddle room. The link is cleared after parsing.").font(.caption).foregroundStyle(.secondary)
            HStack {
                TextField("huddle-control://join?...", text: $model.manualLink)
                    .textFieldStyle(.roundedBorder)
                Button("Open") { model.submitManualLink() }.disabled(model.manualLink.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Button("Copy sanitized diagnostics") { model.copyDiagnostics() }.font(.caption)
            Text("Diagnostics include only app version, macOS, architecture, permission state, and connection state. Nothing is sent automatically.").font(.caption2).foregroundStyle(.secondary)
            Button("Forget trusted Huddle servers") { model.forgetTrustedServers() }.font(.caption).foregroundStyle(.secondary)
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
