import Foundation

public let remoteControlTopic = "huddle:remote-control"
public let maximumControlPacketBytes = 8 * 1024
// Clipboard text remains within the existing Remote Control packet budget once
// JSON framing is included. Larger text is rejected whole, never truncated.
public let maximumClipboardTextBytes = 6 * 1024

public enum MouseButton: String, CaseIterable, Sendable {
    case left, middle, right
}

public enum KeyAction: String, Sendable {
    case down, up
}

public enum KeyModifier: String, CaseIterable, Hashable, Sendable {
    case shift, ctrl, alt, meta
}

public enum ControlInputEvent: Equatable, Sendable {
    case move(x: Double, y: Double)
    case button(action: KeyAction, x: Double, y: Double, button: MouseButton)
    case scroll(x: Double, y: Double, dx: Double, dy: Double)
    case key(action: KeyAction, code: String, key: String?, modifiers: Set<KeyModifier>)
    case releaseAll
}

public enum ControlCommand: Equatable, Sendable {
    case input(ControlInputEvent)
    case clipboardCopy
    case clipboardPaste(String)
}

public struct ControlCommandPacket: Equatable, Sendable {
    public let sessionID: String
    public let sequence: UInt64
    public let command: ControlCommand

    public init(sessionID: String, sequence: UInt64, command: ControlCommand) {
        self.sessionID = sessionID
        self.sequence = sequence
        self.command = command
    }
}

// Keep the old domain name useful to callers that construct mouse/keyboard
// packets, while clipboard commands share the exact same sequence gate.
public typealias ControlInputPacket = ControlCommandPacket

public enum ControlPacketError: Error, Equatable {
    case empty
    case tooLarge
    case malformed
    case unsupportedVersion
    case unsupportedType
    case invalidSession
    case invalidSequence
    case invalidEvent
}

public enum ClipboardText {
    public static func isTransferable(_ value: String) -> Bool {
        !value.isEmpty && value.lengthOfBytes(using: .utf8) <= maximumClipboardTextBytes
    }
}

// Browsers report high-resolution scroll deltas as floating-point CSS pixels,
// while Core Graphics accepts signed integer wheel values. Keep the fractional
// remainder so slow trackpad motion is not silently discarded between packets.
// Core Graphics' wheel direction is opposite the browser's apparent content
// motion, so the conversion intentionally negates both axes at this boundary.
public struct SmoothScrollWheelDelta: Equatable, Sendable {
    public let vertical: Int32
    public let horizontal: Int32

    public init(vertical: Int32, horizontal: Int32) {
        self.vertical = vertical
        self.horizontal = horizontal
    }
}

public struct ScrollDeltaAccumulator: Sendable {
    private var verticalRemainder = 0.0
    private var horizontalRemainder = 0.0

    public init() {}

    public mutating func consume(browserDX: Double, browserDY: Double) -> SmoothScrollWheelDelta? {
        let verticalValue = verticalRemainder - browserDY
        let horizontalValue = horizontalRemainder - browserDX
        let vertical = Int32(verticalValue.rounded(.towardZero))
        let horizontal = Int32(horizontalValue.rounded(.towardZero))

        verticalRemainder = verticalValue - Double(vertical)
        horizontalRemainder = horizontalValue - Double(horizontal)

        guard vertical != 0 || horizontal != 0 else { return nil }
        return SmoothScrollWheelDelta(vertical: vertical, horizontal: horizontal)
    }

    public mutating func reset() {
        verticalRemainder = 0
        horizontalRemainder = 0
    }
}

public enum ControlPacketDecoder {
    private static let maximumJavaScriptInteger = 9_007_199_254_740_991.0
    private static let maximumWheelDelta = 4_096.0

    public static func decode(_ data: Data) throws -> ControlCommandPacket {
        guard !data.isEmpty else { throw ControlPacketError.empty }
        guard data.count <= maximumControlPacketBytes else { throw ControlPacketError.tooLarge }
        guard let root = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            throw ControlPacketError.malformed
        }
        guard integer(root["v"]) == 1 else { throw ControlPacketError.unsupportedVersion }
        guard let type = root["type"] as? String else { throw ControlPacketError.unsupportedType }
        guard let sessionID = root["sessionId"] as? String, validIdentifier(sessionID) else {
            throw ControlPacketError.invalidSession
        }
        guard let sequenceNumber = number(root["sequence"]), sequenceNumber.isFinite,
              sequenceNumber >= 0, sequenceNumber <= maximumJavaScriptInteger,
              sequenceNumber.rounded(.towardZero) == sequenceNumber
        else {
            throw ControlPacketError.invalidSequence
        }
        let command: ControlCommand
        switch type {
        case "remote-control:input":
            guard exactKeys(root, ["v", "type", "sessionId", "sequence", "event"]),
                  let eventObject = root["event"] as? [String: Any], let kind = eventObject["kind"] as? String
            else {
                throw ControlPacketError.invalidEvent
            }
            command = .input(try decodeEvent(kind: kind, object: eventObject))
        case "remote-control:clipboard-copy":
            guard exactKeys(root, ["v", "type", "sessionId", "sequence"]) else { throw ControlPacketError.invalidEvent }
            command = .clipboardCopy
        case "remote-control:clipboard-paste":
            guard exactKeys(root, ["v", "type", "sessionId", "sequence", "text"]),
                  let text = root["text"] as? String,
                  ClipboardText.isTransferable(text)
            else { throw ControlPacketError.invalidEvent }
            command = .clipboardPaste(text)
        default:
            throw ControlPacketError.unsupportedType
        }
        return ControlCommandPacket(sessionID: sessionID, sequence: UInt64(sequenceNumber), command: command)
    }

    private static func decodeEvent(kind: String, object: [String: Any]) throws -> ControlInputEvent {
        switch kind {
        case "move":
            let (x, y) = try point(object)
            return .move(x: x, y: y)
        case "down", "up":
            let (x, y) = try point(object)
            guard let rawButton = object["button"] as? String, let button = MouseButton(rawValue: rawButton) else {
                throw ControlPacketError.invalidEvent
            }
            return .button(action: kind == "down" ? .down : .up, x: x, y: y, button: button)
        case "scroll":
            let (x, y) = try point(object)
            guard let dx = number(object["dx"]), let dy = number(object["dy"]),
                  dx.isFinite, dy.isFinite, abs(dx) <= maximumWheelDelta, abs(dy) <= maximumWheelDelta
            else {
                throw ControlPacketError.invalidEvent
            }
            return .scroll(x: x, y: y, dx: dx, dy: dy)
        case "key":
            guard let rawAction = object["action"] as? String, let action = KeyAction(rawValue: rawAction),
                  let code = object["code"] as? String, KeyboardCodeMap.virtualKey(for: code) != nil
            else {
                throw ControlPacketError.invalidEvent
            }
            let key = object["key"] as? String
            guard key == nil || key!.unicodeScalars.count <= 16 else { throw ControlPacketError.invalidEvent }
            let rawModifiers = object["modifiers"] as? [String] ?? []
            guard rawModifiers.count <= KeyModifier.allCases.count else { throw ControlPacketError.invalidEvent }
            let modifiers = Set(rawModifiers.compactMap(KeyModifier.init(rawValue:)))
            guard modifiers.count == rawModifiers.count else { throw ControlPacketError.invalidEvent }
            return .key(action: action, code: code, key: key, modifiers: modifiers)
        case "release-all":
            return .releaseAll
        default:
            throw ControlPacketError.invalidEvent
        }
    }

    private static func point(_ object: [String: Any]) throws -> (Double, Double) {
        guard let x = number(object["x"]), let y = number(object["y"]),
              x.isFinite, y.isFinite, (0 ... 1).contains(x), (0 ... 1).contains(y)
        else {
            throw ControlPacketError.invalidEvent
        }
        return (x, y)
    }

    private static func number(_ value: Any?) -> Double? {
        guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { return nil }
        return value.doubleValue
    }

    private static func validIdentifier(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 128 && value.unicodeScalars.allSatisfy { scalar in
            scalar.value == 45 || scalar.value == 95 || (48 ... 57).contains(scalar.value) || (65 ... 90).contains(scalar.value) || (97 ... 122).contains(scalar.value)
        }
    }

    private static func exactKeys(_ object: [String: Any], _ keys: Set<String>) -> Bool {
        Set(object.keys) == keys
    }

    private static func integer(_ value: Any?) -> Int? {
        guard let number = number(value), number.rounded(.towardZero) == number else { return nil }
        return Int(exactly: number)
    }
}

public struct ClipboardEchoSuppression: Equatable, Sendable {
    private var expectedChangeCount: Int?

    public init() {}

    public mutating func recordLocalPasteboardWrite(changeCount: Int) {
        expectedChangeCount = changeCount
    }

    public mutating func consumes(changeCount: Int) -> Bool {
        guard let expectedChangeCount else { return false }
        self.expectedChangeCount = nil
        return expectedChangeCount == changeCount
    }

    public mutating func reset() {
        expectedChangeCount = nil
    }
}
