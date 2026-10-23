import XCTest
import CoreGraphics
@testable import ControlAgentCore

final class MouseEventBuilderTests: XCTestCase {
    func testDoubleClickSetsBothNativeDownAndUpCounts() {
        var builder = MouseEventBuilder()
        let point = CGPoint(x: 100, y: 200)
        for (time, type, count): (Double, CGEventType, Int64) in [
            (1, .leftMouseDown, 1), (1.05, .leftMouseUp, 1),
            (1.15, .leftMouseDown, 2), (1.2, .leftMouseUp, 2)
        ] {
            XCTAssertEqual(builder.make(type, point: point, button: .left, time: time, interval: 0.5)?.getIntegerValueField(.mouseEventClickState), count)
        }
    }

    func testDistantDelayedAndResetClicksStartNewSequence() {
        var builder = MouseEventBuilder()
        let point = CGPoint(x: 100, y: 200)
        _ = builder.make(.leftMouseDown, point: point, button: .left, time: 1)
        _ = builder.make(.leftMouseUp, point: point, button: .left, time: 1.01)
        XCTAssertEqual(builder.make(.leftMouseDown, point: CGPoint(x: 150, y: 200), button: .left, time: 1.1)?.getIntegerValueField(.mouseEventClickState), 1)
        _ = builder.make(.leftMouseUp, point: point, button: .left, time: 1.2)
        XCTAssertEqual(builder.make(.leftMouseDown, point: point, button: .left, time: 10)?.getIntegerValueField(.mouseEventClickState), 1)
        _ = builder.make(.leftMouseUp, point: point, button: .left, time: 10.1)
        builder.reset()
        XCTAssertEqual(builder.make(.leftMouseDown, point: point, button: .left, time: 10.2)?.getIntegerValueField(.mouseEventClickState), 1)
    }
}
