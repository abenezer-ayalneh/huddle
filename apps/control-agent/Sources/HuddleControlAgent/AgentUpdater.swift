import Foundation
import Combine
import Sparkle

// Sparkle owns its update preferences in UserDefaults. This wrapper exposes
// just the attended-Control-Agent policy: opt-in automatic updates, a visible
// manual check, and no installer activity while a control session is active.
@MainActor
final class AgentUpdater: NSObject, ObservableObject {
    @Published private(set) var isConfigured = false
    @Published private(set) var automaticUpdatesEnabled = false
    @Published private(set) var message: String?

    private var updaterController: SPUStandardUpdaterController?
    private var resumeAutomaticUpdates = false
    private var remoteControlActive = false

    init(bundle: Bundle = .main) {
        super.init()
        guard let publicKey = bundle.object(forInfoDictionaryKey: "SUPublicEDKey") as? String,
              !publicKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let feed = bundle.object(forInfoDictionaryKey: "SUFeedURL") as? String,
              URL(string: feed)?.scheme == "https"
        else {
            updaterController = nil
            return
        }

        let controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: self, userDriverDelegate: nil)
        updaterController = controller
        isConfigured = true
        automaticUpdatesEnabled = controller.updater.automaticallyChecksForUpdates && controller.updater.automaticallyDownloadsUpdates
    }

    func setAutomaticUpdatesEnabled(_ enabled: Bool) {
        guard let updaterController else {
            message = "Automatic updates are not configured in this Control Agent build."
            return
        }
        guard !remoteControlActive else {
            message = "Automatic updates resume after Remote Control stops."
            return
        }
        updaterController.updater.automaticallyChecksForUpdates = enabled
        updaterController.updater.automaticallyDownloadsUpdates = enabled
        automaticUpdatesEnabled = enabled
        message = enabled
            ? "Automatic updates are on. Huddle checks only while this Control Agent is idle."
            : "Automatic updates are off. You can still check manually."
    }

    func checkForUpdates() {
        guard let updaterController else {
            message = "Updates are not configured in this Control Agent build."
            return
        }
        guard !remoteControlActive else {
            message = "Stop Remote Control before checking for an update."
            return
        }
        updaterController.checkForUpdates(nil)
    }

    func setRemoteControlActive(_ active: Bool) {
        remoteControlActive = active
        guard let updaterController else { return }

        if active {
            resumeAutomaticUpdates = automaticUpdatesEnabled
            guard resumeAutomaticUpdates else { return }
            updaterController.updater.automaticallyChecksForUpdates = false
            updaterController.updater.automaticallyDownloadsUpdates = false
            automaticUpdatesEnabled = false
            message = "Automatic updates are paused during Remote Control."
        } else if resumeAutomaticUpdates {
            updaterController.updater.automaticallyChecksForUpdates = true
            updaterController.updater.automaticallyDownloadsUpdates = true
            automaticUpdatesEnabled = true
            resumeAutomaticUpdates = false
            message = "Automatic updates are back on while the Control Agent is idle."
        }
    }
}

extension AgentUpdater: SPUUpdaterDelegate {
    // Sparkle's setting is persistent and its scheduler is asynchronous. The
    // delegate is therefore the final boundary that prevents a scheduled check
    // or install from interrupting an attended control session.
    func updater(_ updater: SPUUpdater, mayPerform updateCheck: SPUUpdateCheck) throws {
        guard !remoteControlActive else { throw sessionActiveError() }
    }

    func updater(_ updater: SPUUpdater, shouldProceedWithUpdate updateItem: SUAppcastItem, updateCheck: SPUUpdateCheck) throws {
        guard !remoteControlActive else { throw sessionActiveError() }
    }

    func allowedSystemProfileKeys(for updater: SPUUpdater) -> [String]? {
        []
    }

    private func sessionActiveError() -> NSError {
        NSError(
            domain: "com.huddle.control-agent.updater",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Updates are paused while Remote Control is active."]
        )
    }
}
