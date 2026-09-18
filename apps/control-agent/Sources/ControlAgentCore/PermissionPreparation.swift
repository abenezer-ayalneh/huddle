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
    func openScreenRecordingSettings() -> Bool
}

package enum PermissionPreparationAction: Equatable, Sendable {
    case none
    case screenRecording(requestGranted: Bool, didOpenSettings: Bool?)
    case accessibility

    package var requiresScreenRecordingSettingsFallback: Bool {
        guard case .screenRecording(requestGranted: false, didOpenSettings: _) = self else { return false }
        return true
    }

    package var recoveryMessage: String? {
        guard case let .screenRecording(_, didOpenSettings: openedSettings) = self,
              let openedSettings else {
            return nil
        }
        return PermissionSettingsFallback.recoveryMessage(didOpenSettings: openedSettings)
    }
}

package struct PermissionPreparationResult: Equatable, Sendable {
    package let snapshot: PermissionSnapshot
    package let action: PermissionPreparationAction
}

/// Coordinates one user-initiated preparation action. The runtime is injected
/// so selection, fresh reads, and request ordering can be tested without TCC.
@MainActor
package enum PermissionPreparation {
    package static func perform(using runtime: PermissionPreparationRuntime) -> PermissionPreparationResult {
        let snapshot = runtime.readPermissionSnapshot()

        switch snapshot.nextMissingPermission {
        case .screenRecording:
            let requestGranted = runtime.requestScreenRecordingAccess()
            let didOpenSettings = requestGranted ? nil : runtime.openScreenRecordingSettings()
            return PermissionPreparationResult(
                snapshot: runtime.readPermissionSnapshot(),
                action: .screenRecording(
                    requestGranted: requestGranted,
                    didOpenSettings: didOpenSettings,
                ),
            )
        case .accessibility:
            // Re-read after the prompt just as we do for Screen Recording:
            // retaining the pre-prompt snapshot leaves the badge showing
            // "Required" after the app has become trusted.
            runtime.promptForAccessibilityAccess()
            return PermissionPreparationResult(
                snapshot: runtime.readPermissionSnapshot(),
                action: .accessibility,
            )
        case nil:
            return PermissionPreparationResult(snapshot: snapshot, action: .none)
        }
    }
}

/// An undocumented but isolated fallback route for the documented case where a
/// denied Screen Recording request cannot be prompted again by Core Graphics.
package enum PermissionSettingsFallback {
    package static let screenRecordingURL = URL(
        string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
    )!
    package static let manualScreenRecordingInstructions =
        "Could not open System Settings. Open Privacy & Security > Screen Recording and allow Huddle Control Agent."

    package static func recoveryMessage(didOpenSettings: Bool) -> String? {
        didOpenSettings ? nil : manualScreenRecordingInstructions
    }
}
