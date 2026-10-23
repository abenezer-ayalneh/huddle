import AppKit
import CoreGraphics

/// Creates native click sequences without changing the room-scoped wire protocol.
public struct MouseEventBuilder {
    private var previous: (button: CGMouseButton, point: CGPoint, time: TimeInterval, count: Int64)?
    private var held: (button: CGMouseButton, point: CGPoint, time: TimeInterval, count: Int64)?

    public init() {}

    public mutating func reset() { previous = nil; held = nil }

    public mutating func make(_ type: CGEventType, point: CGPoint, button: CGMouseButton, time: TimeInterval = ProcessInfo.processInfo.systemUptime, interval: TimeInterval = NSEvent.doubleClickInterval) -> CGEvent? {
        let down = type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown
        let up = type == .leftMouseUp || type == .rightMouseUp || type == .otherMouseUp
        var count: Int64 = 0
        if down {
            count = 1
            if let last = previous, last.button == button, time >= last.time, time - last.time <= interval,
               hypot(point.x - last.point.x, point.y - last.point.y) <= 4 {
                count = min(last.count + 1, 3)
            }
            held = (button, point, time, count)
            previous = nil
        } else if up, let press = held, press.button == button {
            count = press.count
            if time >= press.time, time - press.time <= interval,
               hypot(point.x - press.point.x, point.y - press.point.y) <= 4 {
                previous = press
            } else { previous = nil }
            held = nil
        }
        let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: button)
        event?.setIntegerValueField(.mouseEventClickState, value: count)
        return event
    }
}
