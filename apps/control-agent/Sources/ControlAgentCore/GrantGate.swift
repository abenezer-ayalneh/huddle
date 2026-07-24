import Foundation

public enum GrantRejection: Error, Equatable, Sendable {
    case disconnected
    case tokenMetadataMismatch
    case roomMetadataMissing
    case roomMetadataMismatch
    case inactive
    case expired
    case wrongSession
    case wrongSender
    case replayedSequence
}

public struct SequenceGate: Sendable {
    private var lastSequence: UInt64?

    public init() {}

    public mutating func accept(_ sequence: UInt64) -> Bool {
        if let lastSequence, sequence <= lastSequence { return false }
        lastSequence = sequence
        return true
    }

    public mutating func reset() {
        lastSequence = nil
    }
}

public struct GrantGate: Sendable {
    public let bootstrap: GrantSnapshot
    private var sequence = SequenceGate()

    public init(bootstrap: GrantSnapshot) {
        self.bootstrap = bootstrap
    }

    // Screen publication is privileged too: the Agent must not expose the
    // desktop merely because it redeemed a bootstrap code. Both the signed
    // helper-token metadata and the SFU-propagated room grant have to match the
    // immutable bootstrap snapshot before capture may start.
    public func canPublishDesktop(
        tokenMetadata: AgentTokenMetadata?,
        localAgentIdentity: String,
        projection: RemoteControlProjection?,
        now: Date
    ) -> Bool {
        hasMatchingTokenMetadata(tokenMetadata, localAgentIdentity: localAgentIdentity) && hasActiveProjection(projection, now: now)
    }

    public func hasValidTokenMetadata(_ tokenMetadata: AgentTokenMetadata?, localAgentIdentity: String) -> Bool {
        hasMatchingTokenMetadata(tokenMetadata, localAgentIdentity: localAgentIdentity)
    }

    public mutating func authorize(
        _ packet: ControlCommandPacket,
        senderIdentity: String,
        localAgentIdentity: String,
        tokenMetadata: AgentTokenMetadata?,
        projection: RemoteControlProjection?,
        connected: Bool,
        now: Date
    ) -> Result<ControlCommand, GrantRejection> {
        guard connected else { return .failure(.disconnected) }
        guard hasMatchingTokenMetadata(tokenMetadata, localAgentIdentity: localAgentIdentity) else {
            return .failure(.tokenMetadataMismatch)
        }
        guard let projection else { return .failure(.roomMetadataMissing) }
        guard projection.sessionID == bootstrap.sessionID,
              projection.sharerIdentity == bootstrap.sharerIdentity,
              projection.controllerIdentity == bootstrap.controllerIdentity,
              projection.agentIdentity == bootstrap.agentIdentity
        else {
            return .failure(.roomMetadataMismatch)
        }
        guard projection.status == "active", projection.agentConnected else { return .failure(.inactive) }
        guard projection.renewalDueAt > now, bootstrap.renewalDueAt <= projection.renewalDueAt else {
            return .failure(.expired)
        }
        guard packet.sessionID == bootstrap.sessionID else { return .failure(.wrongSession) }
        guard senderIdentity == bootstrap.controllerIdentity else { return .failure(.wrongSender) }
        guard sequence.accept(packet.sequence) else { return .failure(.replayedSequence) }
        return .success(packet.command)
    }

    public mutating func resetSequence() {
        sequence.reset()
    }

    private func hasMatchingTokenMetadata(_ tokenMetadata: AgentTokenMetadata?, localAgentIdentity: String) -> Bool {
        guard let tokenMetadata else { return false }
        return tokenMetadata.role == "control-agent" &&
            tokenMetadata.room == bootstrap.room &&
            tokenMetadata.sessionID == bootstrap.sessionID &&
            tokenMetadata.sharerIdentity == bootstrap.sharerIdentity &&
            tokenMetadata.controllerIdentity == bootstrap.controllerIdentity &&
            tokenMetadata.agentIdentity == bootstrap.agentIdentity &&
            localAgentIdentity == bootstrap.agentIdentity
    }

    private func hasActiveProjection(_ projection: RemoteControlProjection?, now: Date) -> Bool {
        guard let projection else { return false }
        return projection.sessionID == bootstrap.sessionID &&
            projection.sharerIdentity == bootstrap.sharerIdentity &&
            projection.controllerIdentity == bootstrap.controllerIdentity &&
            projection.agentIdentity == bootstrap.agentIdentity &&
            projection.status == "active" &&
            projection.agentConnected &&
            projection.renewalDueAt > now &&
            bootstrap.renewalDueAt <= projection.renewalDueAt
    }
}
