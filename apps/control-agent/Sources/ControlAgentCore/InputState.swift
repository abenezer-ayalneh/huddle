import Foundation

public struct InputState: Equatable, Sendable {
    public private(set) var heldButtons: Set<MouseButton> = []
    public private(set) var heldKeyCodes: Set<String> = []

    public init() {}

    public mutating func apply(_ event: ControlInputEvent) {
        switch event {
        case let .button(action, _, _, button):
            if action == .down { heldButtons.insert(button) } else { heldButtons.remove(button) }
        case let .key(action, code, _, _):
            if action == .down { heldKeyCodes.insert(code) } else { heldKeyCodes.remove(code) }
        case .releaseAll:
            heldButtons.removeAll()
            heldKeyCodes.removeAll()
        case .move, .scroll:
            break
        }
    }

    public mutating func drainHeldInputs() -> (buttons: [MouseButton], keyCodes: [String]) {
        let buttons = heldButtons.sorted { $0.rawValue < $1.rawValue }
        let keyCodes = heldKeyCodes.sorted()
        heldButtons.removeAll()
        heldKeyCodes.removeAll()
        return (buttons, keyCodes)
    }
}
