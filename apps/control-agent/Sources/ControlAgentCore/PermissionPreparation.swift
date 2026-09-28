import Foundation

package enum RequiredPermission: Equatable, Sendable {
    case screenRecording
    case accessibility
}

package struct PermissionSnapshot: Equatable, Sendable {
    package let screenRecordingGranted: Bool
    package let accessibilityGranted: Bool

    package init(screenRecordingGranted: Bool, accessibilityGranted: Bool) {
        self.screenRecordingGranted = screenRecordingGranted
        self.accessibilityGranted = accessibilityGranted
    }

    package var isReady: Bool {
        screenRecordingGranted && accessibilityGranted
    }

    package var nextMissingPermission: RequiredPermission? {
        if !screenRecordingGranted { return .screenRecording }
        if !accessibilityGranted { return .accessibility }
        return nil
    }
}

@MainActor
package protocol PermissionPreparationRuntime: AnyObject {
    func readPermissionSnapshot() -> PermissionSnapshot
    func requestScreenRecordingAccess() -> Bool
    func promptForAccessibilityAccess()
}

package enum PermissionPreparationAction: Equatable, Sendable {
    case none
    case screenRecording
    case accessibility
}

package struct PermissionPreparationResult: Equatable, Sendable {
    package let snapshot: PermissionSnapshot
    package let action: PermissionPreparationAction
}

/// Prompts for one specific permission per user action. The runtime is injected
/// so the native prompt and fresh reads can be coordinated without TCC.
@MainActor
package enum PermissionPreparation {
    package static func perform(
        for permission: RequiredPermission,
        using runtime: PermissionPreparationRuntime,
    ) -> PermissionPreparationResult {
        let snapshot = runtime.readPermissionSnapshot()
        return perform(for: permission, with: snapshot, using: runtime)
    }

    private static func perform(
        for permission: RequiredPermission,
        with snapshot: PermissionSnapshot,
        using runtime: PermissionPreparationRuntime,
    ) -> PermissionPreparationResult {
        switch permission {
        case .screenRecording:
            if !snapshot.screenRecordingGranted {
                _ = runtime.requestScreenRecordingAccess()
            }
            return PermissionPreparationResult(
                snapshot: runtime.readPermissionSnapshot(),
                action: .screenRecording,
            )
        case .accessibility:
            if !snapshot.accessibilityGranted {
                runtime.promptForAccessibilityAccess()
            }
            return PermissionPreparationResult(
                snapshot: runtime.readPermissionSnapshot(),
                action: .accessibility,
            )
        }
    }

    package static func perform(using runtime: PermissionPreparationRuntime) -> PermissionPreparationResult {
        let snapshot = runtime.readPermissionSnapshot()
        guard let permission = snapshot.nextMissingPermission else {
            return PermissionPreparationResult(snapshot: snapshot, action: .none)
        }
        return perform(for: permission, with: snapshot, using: runtime)
    }
}
