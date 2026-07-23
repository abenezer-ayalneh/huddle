import CryptoKit
import Foundation

public struct AgentReleaseArtifact: Codable, Equatable, Sendable {
    public let url: URL
    public let sha256: String
    public let sizeBytes: Int
}

public struct AgentReleaseDownloads: Codable, Equatable, Sendable {
    public let arm64: AgentReleaseArtifact
    public let x86_64: AgentReleaseArtifact
}

public struct AgentReleaseManifest: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let channel: String
    public let keyId: String
    public let version: String
    public let minimumSupportedVersion: String
    public let minimumMacOS: String
    public let releasedAt: String
    public let releaseNotesUrl: URL
    public let downloads: AgentReleaseDownloads
}

public enum AgentUpdateDecision: Equatable, Sendable {
    case unavailable
    case current
    case available(version: String, notes: URL)
    case required(version: String, notes: URL)
}

public enum AgentReleaseVerifier {
    public static func verify(manifestData: Data, signatureData: Data, publicKeyBase64: String) -> AgentReleaseManifest? {
        let signature = Data(base64Encoded: signatureData, options: [.ignoreUnknownCharacters])
            ?? (String(data: signatureData, encoding: .utf8).flatMap { Data(base64Encoded: $0.trimmingCharacters(in: .whitespacesAndNewlines)) } ?? Data())
        guard let rawKey = Data(base64Encoded: publicKeyBase64), let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: rawKey),
              !signature.isEmpty,
              publicKey.isValidSignature(signature, for: manifestData),
              let manifest = try? JSONDecoder().decode(AgentReleaseManifest.self, from: manifestData),
              manifest.schemaVersion == 1, manifest.channel == "beta",
              manifest.downloads.arm64.url.scheme == "https", manifest.downloads.x86_64.url.scheme == "https",
              manifest.downloads.arm64.sha256.range(of: "^[a-fA-F0-9]{64}$", options: .regularExpression) != nil,
              manifest.downloads.x86_64.sha256.range(of: "^[a-fA-F0-9]{64}$", options: .regularExpression) != nil
        else { return nil }
        return manifest
    }

    public static func decision(currentVersion: String, manifest: AgentReleaseManifest) -> AgentUpdateDecision {
        if compare(currentVersion, manifest.minimumSupportedVersion) == .orderedAscending {
            return .required(version: manifest.version, notes: manifest.releaseNotesUrl)
        }
        if compare(currentVersion, manifest.version) == .orderedAscending {
            return .available(version: manifest.version, notes: manifest.releaseNotesUrl)
        }
        return .current
    }

    private static func compare(_ lhs: String, _ rhs: String) -> ComparisonResult {
        func numbers(_ value: String) -> [Int] {
            value.split(separator: ".", omittingEmptySubsequences: false).prefix(3).map { Int($0.filter { $0.isNumber }) ?? 0 }
        }
        let left = numbers(lhs), right = numbers(rhs)
        for index in 0 ..< max(left.count, right.count) {
            let l = index < left.count ? left[index] : 0
            let r = index < right.count ? right[index] : 0
            if l != r { return l < r ? .orderedAscending : .orderedDescending }
        }
        return .orderedSame
    }
}

public final class AgentReleaseChecker: @unchecked Sendable {
    public init() {}

    public func check(currentVersion: String, channelURL: URL, publicKeyBase64: String) async -> AgentUpdateDecision {
        guard !publicKeyBase64.isEmpty else { return .unavailable }
        do {
            let (manifestData, _) = try await URLSession.shared.data(from: channelURL.appendingPathComponent("release-manifest.json"))
            let (signatureData, _) = try await URLSession.shared.data(from: channelURL.appendingPathComponent("release-manifest.sig"))
            guard let manifest = AgentReleaseVerifier.verify(manifestData: manifestData, signatureData: signatureData, publicKeyBase64: publicKeyBase64) else { return cachedDecision(currentVersion: currentVersion, publicKeyBase64: publicKeyBase64) }
            saveCache(manifestData: manifestData, signatureData: signatureData)
            return AgentReleaseVerifier.decision(currentVersion: currentVersion, manifest: manifest)
        } catch {
            return cachedDecision(currentVersion: currentVersion, publicKeyBase64: publicKeyBase64)
        }
    }

    private func cacheDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Huddle Control Agent", isDirectory: true)
    }

    private func saveCache(manifestData: Data, signatureData: Data) {
        let directory = cacheDirectory()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? manifestData.write(to: directory.appendingPathComponent("release-manifest.json"), options: .atomic)
        try? signatureData.write(to: directory.appendingPathComponent("release-manifest.sig"), options: .atomic)
    }

    private func cachedDecision(currentVersion: String, publicKeyBase64: String) -> AgentUpdateDecision {
        let directory = cacheDirectory()
        guard let manifestData = try? Data(contentsOf: directory.appendingPathComponent("release-manifest.json")),
              let signatureData = try? Data(contentsOf: directory.appendingPathComponent("release-manifest.sig")),
              let manifest = AgentReleaseVerifier.verify(manifestData: manifestData, signatureData: signatureData, publicKeyBase64: publicKeyBase64)
        else { return .unavailable }
        return AgentReleaseVerifier.decision(currentVersion: currentVersion, manifest: manifest)
    }
}
