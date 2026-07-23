import Foundation

/// Stores only explicitly trusted API origins. It never stores a bootstrap,
/// room code, participant identity, or LiveKit credential.
public final class ServerTrustStore: @unchecked Sendable {
    public static let shared = ServerTrustStore()
    private let defaults: UserDefaults
    private let key = "huddle.control-agent.trusted-origins"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func origin(for url: URL) -> String? {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
        var value = "\(scheme)://\(host)"
        if let port = url.port { value += ":\(port)" }
        return value
    }

    public func isTrusted(_ url: URL) -> Bool {
        guard let value = origin(for: url) else { return false }
        return (defaults.stringArray(forKey: key) ?? []).contains(value)
    }

    public func trust(_ url: URL) {
        guard let value = origin(for: url) else { return }
        var origins = defaults.stringArray(forKey: key) ?? []
        if !origins.contains(value) {
            origins.append(value)
            defaults.set(origins.sorted(), forKey: key)
        }
    }

    public func forget(_ url: URL) {
        guard let value = origin(for: url) else { return }
        defaults.set((defaults.stringArray(forKey: key) ?? []).filter { $0 != value }, forKey: key)
    }

    public func trustedOrigins() -> [String] {
        defaults.stringArray(forKey: key) ?? []
    }
}
