import CoreGraphics
import Foundation

public struct DisplayGeometry: Equatable, Sendable {
    public let displayID: UInt32
    public let bounds: CGRect

    public init(displayID: UInt32, bounds: CGRect) {
        self.displayID = displayID
        self.bounds = bounds
    }
}

public enum CoordinateMapper {
    public static func point(x: Double, y: Double, in geometry: DisplayGeometry) -> CGPoint? {
        guard x.isFinite, y.isFinite, (0 ... 1).contains(x), (0 ... 1).contains(y),
              geometry.bounds.width > 0, geometry.bounds.height > 0
        else {
            return nil
        }
        return CGPoint(
            x: geometry.bounds.minX + CGFloat(x) * geometry.bounds.width,
            // CGEvent cursor locations use Quartz display coordinates, whose
            // vertical direction matches browser/video coordinates: both grow
            // downward from the display's top edge. Do not flip y here.
            y: geometry.bounds.minY + CGFloat(y) * geometry.bounds.height
        )
    }
}
