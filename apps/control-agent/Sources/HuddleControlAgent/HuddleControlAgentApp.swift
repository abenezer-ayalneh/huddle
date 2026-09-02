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
    @Published var switchingDisplay = false
    @Published var screenPermission = CGPreflightScreenCaptureAccess()
    @Published var accessibilityPermission = AXIsProcessTrusted()
    @Published var displays: [DisplayOption] = []
    @Published var selectedDisplayID: UInt32?
    @Published var pendingTrustOrigin: String?
    @Published var manualLink = ""

    private var agent: LiveKitAgent?
    private var pendingDescriptor: BootstrapDescriptor?
    private let releaseChecker = AgentReleaseChecker()
    let updater = AgentUpdater()

    var appVersion: String { (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0.0" }
    var releaseChannelURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ControlAgentReleaseChannelURL") as? String,
              !value.isEmpty,
              let url = URL(string: value),
              url.scheme == "https"
        else { return nil }
        return url
    }
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
        guard !switchingDisplay, let selectedDisplayID, let agent else { return }
        Task { await agent.startScreen(displayID: selectedDisplayID) }
    }

    func selectDisplay(_ displayID: UInt32) {
        guard selectedDisplayID != displayID else { return }
        selectedDisplayID = displayID
        guard screenPublished, !switchingDisplay, let agent else { return }
        screenPublished = false
        switchingDisplay = true
        status = "Switching display… The Controller is temporarily disabled."
        Task { await agent.changeDisplay(displayID: displayID) }
    }

    private func begin(_ descriptor: BootstrapDescriptor) async {
        if let releaseChannelURL {
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
        switchingDisplay = false
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
            updater.setRemoteControlActive(true)
            status = "Connected to \(response.room). Choose a display, then start Remote Control."
        } catch let caught {
            error = caught.localizedDescription
            status = "Could not start Control Agent."
        }
    }

    fileprivate func updateConnection(_ isConnected: Bool, screen: Bool, message: String, switching: Bool = false) {
        connected = isConnected
        screenPublished = screen
        switchingDisplay = switching
        if !isConnected { updater.setRemoteControlActive(false) }
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
    private var switchingDisplay = false
    private var screenPublication: LocalTrackPublication?
    private var selectedDisplayID: UInt32?
    private var stopping = false
    private var clipboardChangeCount = 0
    private var clipboardRevision: UInt64 = 0
    private var clipboardEcho = ClipboardEchoSuppression()
    private var clipboardMonitor: Task<Void, Never>?

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
              !switchingDisplay,
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
            guard gate.canPublishDesktop(
                tokenMetadata: tokenMetadata,
                localAgentIdentity: response.session.agentIdentity,
                projection: projection,
                now: Date(),
            ), !stopping else {
                return
            }
            // The Controller sees a low-latency browser Control Cursor. Including
            // the captured macOS cursor here would create delayed video feedback.
            let track = LocalVideoTrack.createMacOSScreenShareTrack(
                source: source,
                options: ScreenShareCaptureOptions(showCursor: false, appAudio: false, captureEntireDisplay: true),
            )
            screenPublication = try await room.localParticipant.publish(videoTrack: track)
            selectedDisplayID = displayID
            screenPublished = true
            await startClipboardMonitoring()
            await model?.updateConnection(true, screen: true, message: "The entire selected display is visible to the Huddle room.")
        } catch {
            await model?.updateConnection(true, screen: false, message: "Connected, but Screen Recording permission is required.")
        }
    }

    func changeDisplay(displayID: UInt32) async {
        guard screenPublished,
              !switchingDisplay,
              displayID != selectedDisplayID,
              gate.canPublishDesktop(
                  tokenMetadata: tokenMetadata,
                  localAgentIdentity: response.session.agentIdentity,
                  projection: projection,
                  now: Date(),
              )
        else { return }

        // Set the gate before any await. This makes the protected gap
        // non-interactive even while LiveKit is still unpublishing the old
        // display.
        switchingDisplay = true
        screenPublished = false
        input.releaseAll()
        stopClipboardMonitoring()
        let oldPublication = screenPublication
        screenPublication = nil
        await model?.updateConnection(true, screen: false, message: "Switching display… The Controller is temporarily disabled.", switching: true)
        if let oldPublication {
            _ = try? await room.localParticipant.unpublish(publication: oldPublication)
        }

        do {
            let sources = try await MacOSScreenCapturer.sources(for: .display)
            guard let source = sources.compactMap({ $0 as? MacOSDisplay }).first(where: { $0.displayID == displayID }) else {
                switchingDisplay = false
                await model?.updateConnection(true, screen: false, message: "Display switch failed. Choose a display and retry.")
                return
            }
            guard gate.canPublishDesktop(
                tokenMetadata: tokenMetadata,
                localAgentIdentity: response.session.agentIdentity,
                projection: projection,
                now: Date(),
            ), !stopping else {
                switchingDisplay = false
                return
            }
            let track = LocalVideoTrack.createMacOSScreenShareTrack(
                source: source,
                options: ScreenShareCaptureOptions(showCursor: false, appAudio: false, captureEntireDisplay: true),
            )
            screenPublication = try await room.localParticipant.publish(videoTrack: track)
            selectedDisplayID = displayID
            switchingDisplay = false
            screenPublished = true
            await startClipboardMonitoring()
            // selectedDisplayID is updated before screenPublished is re-enabled,
            // so the next accepted input packet uses the new Quartz geometry.
            await model?.updateConnection(true, screen: true, message: "The entire selected display is visible to the Huddle room.")
        } catch {
            screenPublication = nil
            switchingDisplay = false
            screenPublished = false
            await model?.updateConnection(true, screen: false, message: "Display switch failed. Choose a display and retry.")
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
        stopClipboardMonitoring()
        // Set this before awaiting unpublish/disconnect so an already-running
        // pasteboard observation cannot publish after local Stop.
        screenPublished = false
        switchingDisplay = false
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
        if !screenPublished && !switchingDisplay {
            await model?.updateConnection(true, screen: false, message: "Choose a display, then start Remote Control.")
        }
    }

    private func decodeMetadata(_ metadata: String?) -> AgentTokenMetadata? {
        guard let data = metadata?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(AgentTokenMetadata.self, from: data)
    }

    private func revokeGrant(message: String) async {
        input.releaseAll()
        stopClipboardMonitoring()
        switchingDisplay = false
        if screenPublished {
            // Block clipboard delivery before the asynchronous unpublish.
            screenPublished = false
            if let screenPublication { _ = try? await room.localParticipant.unpublish(publication: screenPublication) }
            screenPublication = nil
        }
        await model?.updateConnection(true, screen: false, message: message)
    }

    private func receive(_ data: Data, sender: String?) async {
        guard screenPublished, !switchingDisplay else { return }
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
        guard case let .success(command) = result else { return }
        switch command {
        case let .input(event):
            input.apply(event, geometry: currentGeometry())
        case .clipboardCopy:
            // The browser will already have seen Ctrl/Command down before the
            // shortcut key. Release that platform modifier so this is exactly
            // the macOS Command-C gesture, including for Windows/Linux
            // Controllers.
            input.releaseAll()
            input.copy()
        case let .clipboardPaste(text):
            input.releaseAll()
            guard let changeCount = await writeClipboard(text) else { return }
            clipboardEcho.recordLocalPasteboardWrite(changeCount: changeCount)
            clipboardChangeCount = changeCount
            input.paste()
        }
    }

    private func startClipboardMonitoring() async {
        clipboardMonitor?.cancel()
        clipboardEcho.reset()
        clipboardChangeCount = await pasteboardSnapshot().changeCount
        clipboardMonitor = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                guard !Task.isCancelled else { return }
                await self?.checkClipboard()
            }
        }
    }

    private func stopClipboardMonitoring() {
        clipboardMonitor?.cancel()
        clipboardMonitor = nil
        clipboardEcho.reset()
    }

    private func checkClipboard() async {
        guard screenPublished,
              gate.canPublishDesktop(
                  tokenMetadata: tokenMetadata,
                  localAgentIdentity: response.session.agentIdentity,
                  projection: projection,
                  now: Date(),
              )
        else { return }

        let snapshot = await pasteboardSnapshot()
        guard snapshot.changeCount != clipboardChangeCount else { return }
        clipboardChangeCount = snapshot.changeCount
        guard !clipboardEcho.consumes(changeCount: snapshot.changeCount),
              let text = snapshot.text,
              ClipboardText.isTransferable(text)
        else { return }
        await publishClipboardUpdate(text)
    }

    private func pasteboardSnapshot() async -> (changeCount: Int, text: String?) {
        await MainActor.run {
            let pasteboard = NSPasteboard.general
            return (pasteboard.changeCount, pasteboard.string(forType: .string))
        }
    }

    private func writeClipboard(_ text: String) async -> Int? {
        await MainActor.run {
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            guard pasteboard.setString(text, forType: .string) else { return nil }
            return pasteboard.changeCount
        }
    }

    private func publishClipboardUpdate(_ text: String) async {
        // A pasteboard read crosses actors. Re-check the active grant at the
        // last possible point so expiry, metadata revocation, or disconnect
        // cannot leak a value that was observed just before session end.
        guard screenPublished,
              gate.canPublishDesktop(
                  tokenMetadata: tokenMetadata,
                  localAgentIdentity: response.session.agentIdentity,
                  projection: projection,
                  now: Date(),
              ),
              ClipboardText.isTransferable(text)
        else { return }
        clipboardRevision &+= 1
        let payload: [String: Any] = [
            "v": 1,
            "type": "remote-control:clipboard-update",
            "sessionId": response.session.sessionID,
            "revision": clipboardRevision,
            "text": text,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload), data.count <= maximumControlPacketBytes else { return }
        let options = DataPublishOptions(
            destinationIdentities: [Participant.Identity(from: response.session.controllerIdentity)],
            topic: remoteControlTopic,
            reliable: true,
        )
        try? await room.localParticipant.publish(data: data, options: options)
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
        stopClipboardMonitoring()
        screenPublished = false
        switchingDisplay = false
        await model?.updateConnection(false, screen: false, message: stopping ? "Control Agent stopped." : "Disconnected from the Huddle room.")
    }
}

private struct InputInjector {
    private var state = InputState()
    private var scroll = ScrollDeltaAccumulator()

    mutating func apply(_ event: ControlInputEvent, geometry: DisplayGeometry) {
        switch event {
        case let .move(x, y): postMouse(.mouseMoved, x: x, y: y, button: .left, geometry: geometry)
        case let .button(action, x, y, button):
            postMouse(action == .down ? mouseDown(button) : mouseUp(button), x: x, y: y, button: button, geometry: geometry)
            state.apply(event)
        case let .scroll(x, y, dx, dy):
            guard let point = CoordinateMapper.point(x: x, y: y, in: geometry) else { return }
            // Pointer moves are intentionally lossy, so use the scroll packet's
            // own coordinate to make the visible target receive the event.
            post(.mouseMoved, point: point, button: .left)
            guard let delta = scroll.consume(browserDX: dx, browserDY: dy) else { return }
            let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: delta.vertical, wheel2: delta.horizontal, wheel3: 0)
            event?.location = point
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
        scroll.reset()
        let held = state.drainHeldInputs()
        let point = NSEvent.mouseLocation
        for button in held.buttons { post(mouseUp(button), point: point, button: button) }
        for code in held.keyCodes where KeyboardCodeMap.virtualKey(for: code) != nil {
            CGEvent(keyboardEventSource: nil, virtualKey: KeyboardCodeMap.virtualKey(for: code)!, keyDown: false)?.post(tap: .cghidEventTap)
        }
    }

    func copy() { postCommandShortcut(code: "KeyC") }

    func paste() { postCommandShortcut(code: "KeyV") }

    private func postMouse(_ type: CGEventType, x: Double, y: Double, button: MouseButton, geometry: DisplayGeometry) {
        guard let point = CoordinateMapper.point(x: x, y: y, in: geometry) else { return }
        post(type, point: point, button: button)
    }
    private func post(_ type: CGEventType, point: CGPoint, button: MouseButton) { CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: button == .right ? .right : button == .middle ? .center : .left)?.post(tap: .cghidEventTap) }
    private func postCommandShortcut(code: String) {
        guard let keyCode = KeyboardCodeMap.virtualKey(for: code) else { return }
        let down = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)
        down?.flags = .maskCommand
        down?.post(tap: .cghidEventTap)
        let up = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)
        up?.flags = .maskCommand
        up?.post(tap: .cghidEventTap)
    }
    private func mouseDown(_ button: MouseButton) -> CGEventType { button == .right ? .rightMouseDown : button == .middle ? .otherMouseDown : .leftMouseDown }
    private func mouseUp(_ button: MouseButton) -> CGEventType { button == .right ? .rightMouseUp : button == .middle ? .otherMouseUp : .leftMouseUp }
    private func flag(for modifier: KeyModifier) -> CGEventFlags { modifier == .shift ? .maskShift : modifier == .ctrl ? .maskControl : modifier == .alt ? .maskAlternate : .maskCommand }
    private func eventFromKey(_ action: KeyAction, code: String, modifiers: Set<KeyModifier>) -> ControlInputEvent { .key(action: action, code: code, key: nil, modifiers: modifiers) }
}

private enum HuddleTheme {
    static let background = Color(red: 0.965, green: 0.933, blue: 0.859)
    static let backgroundDeep = Color(red: 0.918, green: 0.875, blue: 0.784)
    static let surface = Color(red: 1.0, green: 0.98, blue: 0.941)
    static let surfaceStrong = Color(red: 0.941, green: 0.894, blue: 0.804)
    static let purple = Color(red: 0.553, green: 0.149, blue: 0.463)
    static let purpleDark = Color(red: 0.435, green: 0.098, blue: 0.369)
    static let yellow = Color(red: 0.953, green: 0.69, blue: 0.11)
    static let red = Color(red: 0.933, green: 0.204, blue: 0.184)
    static let text = Color(red: 0.078, green: 0.078, blue: 0.078)
    static let muted = Color(red: 0.384, green: 0.349, blue: 0.31)
    static let border = Color(red: 0.835, green: 0.78, blue: 0.69)
    static let borderStrong = Color(red: 0.737, green: 0.659, blue: 0.541)
}

private struct HuddleBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                HuddleTheme.background
                HandoffRoute(color: HuddleTheme.purple.opacity(0.42), width: proxy.size.width * 0.7)
                    .rotationEffect(.degrees(15))
                    .offset(x: proxy.size.width * 0.32, y: -proxy.size.height * 0.28)
                HandoffRoute(color: HuddleTheme.yellow.opacity(0.62), width: proxy.size.width * 0.48)
                    .rotationEffect(.degrees(-11))
                    .offset(x: -proxy.size.width * 0.28, y: proxy.size.height * 0.3)
            }
        }
        .ignoresSafeArea()
    }
}

private struct HandoffRoute: View {
    let color: Color
    let width: CGFloat

    var body: some View {
        HStack(spacing: 0) {
            Circle().fill(HuddleTheme.background).overlay(Circle().stroke(color, lineWidth: 1)).frame(width: 7, height: 7)
            Rectangle().fill(color).frame(width: width, height: 1)
            Circle().fill(HuddleTheme.background).overlay(Circle().stroke(color, lineWidth: 1)).frame(width: 7, height: 7)
        }
    }
}

private struct HuddleMark: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
                .fill(HuddleTheme.purple)
                .overlay(RoundedRectangle(cornerRadius: size * 0.18, style: .continuous).stroke(HuddleTheme.purpleDark, lineWidth: 1))
            Circle().fill(HuddleTheme.yellow).frame(width: size * 0.17).offset(y: -size * 0.31)
            Circle().fill(HuddleTheme.yellow).frame(width: size * 0.17).offset(x: size * 0.31)
            Circle().fill(HuddleTheme.yellow).frame(width: size * 0.17).offset(y: size * 0.31)
            Circle().fill(HuddleTheme.yellow).frame(width: size * 0.17).offset(x: -size * 0.31)
            Image(systemName: "cursorarrow")
                .font(.system(size: size * 0.34, weight: .bold))
                .foregroundStyle(HuddleTheme.surface)
        }
        .frame(width: size, height: size)
    }
}

private struct HuddleCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(HuddleTheme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(HuddleTheme.borderStrong))
                    .shadow(color: HuddleTheme.purple.opacity(0.14), radius: 0, x: 7, y: 9)
            )
    }
}

private enum HuddleButtonTone {
    case primary
    case secondary
    case danger
}

private struct HuddleButtonStyle: ButtonStyle {
    let tone: HuddleButtonTone
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(foreground)
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(background.opacity(configuration.isPressed ? 0.72 : 1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(border)
            )
            .opacity(isEnabled ? 1 : 0.42)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    private var foreground: Color {
        tone == .primary ? HuddleTheme.surface : tone == .danger ? HuddleTheme.red : HuddleTheme.purple
    }

    private var background: Color {
        tone == .primary ? HuddleTheme.purple : tone == .danger ? HuddleTheme.red.opacity(0.08) : HuddleTheme.surface
    }

    private var border: Color {
        tone == .primary ? HuddleTheme.purpleDark : tone == .danger ? HuddleTheme.red.opacity(0.65) : HuddleTheme.borderStrong
    }
}

private struct StepHeading: View {
    let number: Int
    let title: String
    let complete: Bool

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous).fill(complete ? HuddleTheme.yellow.opacity(0.28) : HuddleTheme.backgroundDeep)
                if complete {
                    Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(HuddleTheme.purple)
                } else {
                    Text("\(number)").font(.system(size: 11, weight: .bold)).foregroundStyle(HuddleTheme.muted)
                }
            }
            .frame(width: 26, height: 26)
            Text(title).font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(HuddleTheme.text)
        }
    }
}

private struct PermissionBadge: View {
    let name: String
    let granted: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: granted ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(granted ? HuddleTheme.purple : HuddleTheme.red)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 13, weight: .medium)).foregroundStyle(HuddleTheme.text)
                Text(granted ? "Granted" : "Required").font(.caption).foregroundStyle(granted ? HuddleTheme.purple : HuddleTheme.red)
            }
            Spacer()
        }
        .padding(11)
        .background(HuddleTheme.backgroundDeep, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
}

struct AgentView: View {
    @ObservedObject var model: AgentModel
    @State private var helpExpanded = false

    private var permissionsReady: Bool {
        model.screenPermission && model.accessibilityPermission
    }

    var body: some View {
        ZStack {
            HuddleBackdrop()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    if let updateNotice = model.updateNotice {
                        notice(updateNotice, icon: "arrow.down.circle.fill", color: HuddleTheme.yellow)
                    }
                    if let error = model.error {
                        notice(error, icon: "exclamationmark.octagon.fill", color: HuddleTheme.red)
                    }

                    trustStep
                    permissionsStep
                    updateStep
                    displayStep
                    helpSection

                    Text("Huddle Control Agent \(model.appVersion) · Attended and room-scoped")
                        .font(.caption2)
                        .foregroundStyle(HuddleTheme.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                }
                .frame(maxWidth: 700)
                .padding(32)
                .frame(maxWidth: .infinity)
            }
        }
        .frame(minWidth: 560, minHeight: 680)
        .onAppear { model.refreshPermissions() }
    }

    private var header: some View {
        HStack(spacing: 16) {
            HuddleMark(size: 62)
            VStack(alignment: .leading, spacing: 4) {
                Text("HUDDLE / REMOTE CONTROL").font(.system(size: 10, weight: .bold, design: .monospaced)).tracking(1.8).foregroundStyle(HuddleTheme.purple)
                Text("Control handoff").font(.system(size: 27, weight: .bold, design: .rounded)).foregroundStyle(HuddleTheme.text)
                Text(model.status).font(.callout).foregroundStyle(HuddleTheme.muted).lineLimit(2)
            }
            Spacer()
            statusPill
        }
        .padding(.bottom, 8)
    }

    private var statusPill: some View {
        let active = model.screenPublished
        let connected = model.connected
        return Label(
            active ? "ACTIVE" : connected ? "CONNECTED" : "WAITING",
            systemImage: active ? "cursorarrow.motionlines" : connected ? "link" : "circle.dotted"
        )
        .font(.system(size: 10, weight: .bold, design: .monospaced))
        .foregroundStyle(active || connected ? HuddleTheme.purple : HuddleTheme.muted)
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background((active ? HuddleTheme.yellow : connected ? HuddleTheme.purple : HuddleTheme.backgroundDeep).opacity(active || connected ? 0.22 : 1), in: Capsule())
        .overlay(Capsule().stroke(active || connected ? HuddleTheme.purple.opacity(0.5) : HuddleTheme.borderStrong))
    }

    private var trustStep: some View {
        HuddleCard {
            VStack(alignment: .leading, spacing: 12) {
                StepHeading(number: 1, title: "Confirm the Huddle session", complete: model.descriptor != nil && model.pendingTrustOrigin == nil)
                if let origin = model.pendingTrustOrigin {
                    Text("Trust this Huddle server?").font(.title3.weight(.bold)).foregroundStyle(HuddleTheme.text)
                    Text(origin)
                        .font(.body.monospaced())
                        .foregroundStyle(HuddleTheme.purple)
                        .textSelection(.enabled)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(HuddleTheme.backgroundDeep, in: RoundedRectangle(cornerRadius: 9))
                    Text("Only this server origin is remembered. The room and one-time link are never saved.")
                        .font(.caption)
                        .foregroundStyle(HuddleTheme.muted)
                    Button("Trust & Continue") { model.confirmServerTrust() }
                        .buttonStyle(HuddleButtonStyle(tone: .primary))
                } else if let session = model.session {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Session confirmed").font(.system(size: 13, weight: .semibold)).foregroundStyle(HuddleTheme.purple)
                            Text("\(session.controllerName) controls \(session.sharerName)'s selected display")
                                .font(.callout)
                                .foregroundStyle(HuddleTheme.muted)
                        }
                        Spacer()
                        Image(systemName: "checkmark.seal.fill").font(.title2).foregroundStyle(HuddleTheme.purple)
                    }
                } else {
                    HStack(spacing: 12) {
                        Image(systemName: "arrow.left.arrow.right").font(.title2).foregroundStyle(HuddleTheme.purple)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Open Remote Control from your Huddle room").font(.system(size: 13, weight: .semibold)).foregroundStyle(HuddleTheme.text)
                            Text("This app stays inert until the Sharer approves a request and opens the one-time link.")
                                .font(.caption)
                                .foregroundStyle(HuddleTheme.muted)
                        }
                    }
                }
            }
        }
    }

    private var permissionsStep: some View {
        HuddleCard {
            VStack(alignment: .leading, spacing: 12) {
                StepHeading(number: 2, title: "Allow control on this Mac", complete: permissionsReady)
                Text("Screen Recording publishes the selected display. Accessibility applies only the approved Controller's mouse and keyboard input.")
                    .font(.caption)
                    .foregroundStyle(HuddleTheme.muted)
                HStack(spacing: 10) {
                    PermissionBadge(name: "Screen Recording", granted: model.screenPermission)
                    PermissionBadge(name: "Accessibility", granted: model.accessibilityPermission)
                }
                HStack(spacing: 8) {
                    Button(permissionsReady ? "Permissions ready" : "Prepare for Remote Control") { model.requestPermissions() }
                        .buttonStyle(HuddleButtonStyle(tone: permissionsReady ? .secondary : .primary))
                    Button("Refresh") { model.refreshPermissions() }
                        .buttonStyle(HuddleButtonStyle(tone: .secondary))
                }
            }
        }
    }

    private var displayStep: some View {
        HuddleCard {
            VStack(alignment: .leading, spacing: 12) {
                StepHeading(number: 3, title: "Choose a display and start", complete: model.screenPublished)
                if model.switchingDisplay {
                    Label("Switching display… The Controller is disabled until the replacement is live.", systemImage: "arrow.triangle.2.circlepath")
                        .font(.callout)
                        .foregroundStyle(HuddleTheme.purple)
                    Button("Stop session") { model.stop() }
                        .buttonStyle(HuddleButtonStyle(tone: .danger))
                } else if model.screenPublished, let session = model.session {
                    HStack(alignment: .top, spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(HuddleTheme.yellow.opacity(0.28))
                            Image(systemName: "display.and.arrow.down").foregroundStyle(HuddleTheme.purple)
                        }
                        .frame(width: 42, height: 42)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Remote Control is active").font(.system(size: 15, weight: .semibold)).foregroundStyle(HuddleTheme.text)
                            Text("The entire physical display is visible, including the Control Agent window. \(session.controllerName) can control it until either of you stops.")
                                .font(.caption)
                                .foregroundStyle(HuddleTheme.muted)
                        }
                        Spacer()
                    }
                    if !model.displays.isEmpty {
                        Picker(
                            "Change display",
                            selection: Binding(
                                get: { model.selectedDisplayID ?? model.displays[0].id },
                                set: { model.selectDisplay($0) }
                            )
                        ) {
                            ForEach(model.displays) { display in
                                Text("\(display.title) · \(display.dimensions)").tag(display.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(HuddleTheme.purple)
                    }
                    Button("Stop") { model.stop() }
                        .buttonStyle(HuddleButtonStyle(tone: .danger))
                } else if model.session != nil && model.connected {
                    if model.displays.isEmpty {
                        Label("No displays are available yet. Refresh permissions, then try again.", systemImage: "display.trianglebadge.exclamationmark")
                            .font(.callout)
                            .foregroundStyle(HuddleTheme.red)
                    } else {
                        Text("Only the entire selected physical display is published, including the Control Agent window. Desktop audio is never captured.")
                            .font(.caption)
                            .foregroundStyle(HuddleTheme.muted)
                        Picker(
                            "Display",
                            selection: Binding(
                                get: { model.selectedDisplayID ?? model.displays[0].id },
                                set: { model.selectedDisplayID = $0 }
                            )
                        ) {
                            ForEach(model.displays) { display in
                                Text("\(display.title) · \(display.dimensions)").tag(display.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(HuddleTheme.purple)
                    }
                    HStack(spacing: 8) {
                        Button("Start Remote Control") { model.startRemoteControl() }
                            .buttonStyle(HuddleButtonStyle(tone: .primary))
                            .disabled(model.displays.isEmpty || !permissionsReady || model.pendingTrustOrigin != nil)
                        Button("Stop session") { model.stop() }
                            .buttonStyle(HuddleButtonStyle(tone: .danger))
                    }
                } else if model.session != nil {
                    Label("Connecting to the approved Huddle room…", systemImage: "network")
                        .font(.callout)
                        .foregroundStyle(HuddleTheme.muted)
                } else {
                    Label("Complete the approved Huddle link before choosing a display.", systemImage: "lock.fill")
                        .font(.callout)
                        .foregroundStyle(HuddleTheme.muted)
                }
            }
        }
    }

    private var updateStep: some View {
        HuddleCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Control Agent updates", systemImage: "arrow.triangle.2.circlepath")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(HuddleTheme.text)
                if model.updater.isConfigured {
                    Text("Updates are optional. Automatic download and installation is disabled by default and is paused for every active Remote Control session.")
                        .font(.caption)
                        .foregroundStyle(HuddleTheme.muted)
                    Toggle(
                        "Automatically download and install updates",
                        isOn: Binding(
                            get: { model.updater.automaticUpdatesEnabled },
                            set: { model.updater.setAutomaticUpdatesEnabled($0) }
                        )
                    )
                    .toggleStyle(.switch)
                    .tint(HuddleTheme.purple)
                    .disabled(model.connected)
                    HStack(spacing: 8) {
                        Button("Check for updates") { model.updater.checkForUpdates() }
                            .buttonStyle(HuddleButtonStyle(tone: .secondary))
                            .disabled(model.connected)
                        if model.connected {
                            Text("Available when the session stops")
                                .font(.caption)
                                .foregroundStyle(HuddleTheme.muted)
                        }
                    }
                    if let message = model.updater.message {
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(HuddleTheme.muted)
                    }
                } else {
                    Text("This local build has no signed update channel. Install a configured public beta to receive update options.")
                        .font(.caption)
                        .foregroundStyle(HuddleTheme.muted)
                }
            }
        }
    }

    private var helpSection: some View {
        HuddleCard {
            DisclosureGroup(isExpanded: $helpExpanded) {
                VStack(alignment: .leading, spacing: 12) {
                    Divider().overlay(HuddleTheme.border)
                    Text("Manual launch fallback").font(.system(size: 13, weight: .semibold)).foregroundStyle(HuddleTheme.text)
                    Text("Paste the complete huddle-control:// link from the Huddle room. It is cleared immediately after parsing.")
                        .font(.caption)
                        .foregroundStyle(HuddleTheme.muted)
                    HStack(spacing: 8) {
                        TextField("huddle-control://join?...", text: $model.manualLink)
                            .textFieldStyle(.plain)
                            .font(.body.monospaced())
                            .padding(.horizontal, 11)
                            .frame(minHeight: 36)
                            .background(HuddleTheme.backgroundDeep, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(HuddleTheme.borderStrong))
                        Button("Open") { model.submitManualLink() }
                            .buttonStyle(HuddleButtonStyle(tone: .secondary))
                            .disabled(model.manualLink.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    Divider().overlay(HuddleTheme.border)
                    Text("Diagnostics contain only app version, macOS, architecture, permissions, and connection state. Nothing is sent automatically.")
                        .font(.caption)
                        .foregroundStyle(HuddleTheme.muted)
                    HStack(spacing: 8) {
                        Button("Copy sanitized diagnostics") { model.copyDiagnostics() }
                            .buttonStyle(HuddleButtonStyle(tone: .secondary))
                        Button("Forget trusted servers") { model.forgetTrustedServers() }
                            .buttonStyle(HuddleButtonStyle(tone: .danger))
                    }
                }
                .padding(.top, 12)
            } label: {
                Label("Having trouble?", systemImage: "questionmark.circle")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(HuddleTheme.text)
            }
            .tint(HuddleTheme.purple)
        }
    }

    private func notice(_ text: String, icon: String, color: Color) -> some View {
        Label(text, systemImage: icon)
            .font(.callout)
            .foregroundStyle(color)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(color.opacity(0.22)))
    }
}

@main
struct HuddleControlAgentApp: App {
    @StateObject private var model = AgentModel()
    var body: some Scene {
        WindowGroup {
            AgentView(model: model)
                .onOpenURL { url in
                    do { model.accept(try BootstrapLink.parse(url)) } catch { model.error = error.localizedDescription }
                }
                .task {
                    if let descriptor = try? BootstrapLink.commandLine(arguments: CommandLine.arguments) { model.accept(descriptor) }
                }
        }
        .defaultSize(width: 660, height: 760)
    }
}
