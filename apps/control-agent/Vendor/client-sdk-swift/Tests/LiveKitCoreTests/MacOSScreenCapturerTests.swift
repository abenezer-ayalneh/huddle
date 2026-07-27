#if os(macOS)
import XCTest
@testable import LiveKit

final class MacOSScreenCapturerTests: XCTestCase {
    func testCaptureEntireDisplaySelectsNoExclusionFilter() {
        XCTAssertEqual(
            MacOSScreenCapturer.displayFilterKind(for: ScreenShareCaptureOptions(captureEntireDisplay: true)),
            .entireDisplay,
        )
        XCTAssertEqual(
            MacOSScreenCapturer.displayFilterKind(for: ScreenShareCaptureOptions()),
            .applications,
        )
    }

    func testCaptureDimensionsUseSelectedDisplay() {
        XCTAssertEqual(
            MacOSScreenCapturer.captureDimensions(displayWidth: 2560, displayHeight: 1440),
            Dimensions(width: 5120, height: 2880),
        )
    }
}
#endif
