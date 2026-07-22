import Foundation

public let remoteControlTopic = "huddle:remote-control"
public let maximumControlPacketBytes = 8 * 1024

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

public struct ControlInputPacket: Equatable, Sendable {
    public let sessionID: String
    public let sequence: UInt64
    public let event: ControlInputEvent

    public init(sessionID: String, sequence: UInt64, event: ControlInputEvent) {
        self.sessionID = sessionID
        self.sequence = sequence
        self.event = event
    }
}

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

public enum ControlPacketDecoder {
    private static let maximumJavaScriptInteger = 9_007_199_254_740_991.0
    private static let maximumWheelDelta = 4_096.0

    public static func decode(_ data: Data) throws -> ControlInputPacket {
        guard !data.isEmpty else { throw ControlPacketError.empty }
        guard data.count <= maximumControlPacketBytes else { throw ControlPacketError.tooLarge }
        guard let root = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            throw ControlPacketError.malformed
        }
        guard integer(root["v"]) == 1 else { throw ControlPacketError.unsupportedVersion }
        guard root["type"] as? String == "remote-control:input" else { throw ControlPacketError.unsupportedType }
        guard let sessionID = root["sessionId"] as? String, validIdentifier(sessionID) else {
            throw ControlPacketError.invalidSession
        }
        guard let sequenceNumber = number(root["sequence"]), sequenceNumber.isFinite,
              sequenceNumber >= 0, sequenceNumber <= maximumJavaScriptInteger,
              sequenceNumber.rounded(.towardZero) == sequenceNumber
        else {
            throw ControlPacketError.invalidSequence
        }
        guard let eventObject = root["event"] as? [String: Any], let kind = eventObject["kind"] as? String else {
            throw ControlPacketError.invalidEvent
        }
        let event = try decodeEvent(kind: kind, object: eventObject)
        return ControlInputPacket(sessionID: sessionID, sequence: UInt64(sequenceNumber), event: event)
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

    private static func integer(_ value: Any?) -> Int? {
        guard let number = number(value), number.rounded(.towardZero) == number else { return nil }
        return Int(exactly: number)
    }
}
