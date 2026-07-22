import Foundation

public enum WireDate {
    public static func parse(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }
}

public struct BootstrapResponse: Decodable, Sendable {
    public let token: String
    public let livekitURL: String
    public let room: String
    public let session: BootstrapSession

    enum CodingKeys: String, CodingKey {
        case token
        case livekitURL = "livekitUrl"
        case room
        case session
    }
}

public struct BootstrapSession: Decodable, Equatable, Sendable {
    public let sessionID: String
    public let sharerIdentity: String
    public let sharerName: String
    public let controllerIdentity: String
    public let controllerName: String
    public let agentIdentity: String
    public let status: String
    public let agentConnected: Bool
    public let renewalDueAt: Date

    enum CodingKeys: String, CodingKey {
        case sessionID = "sessionId"
        case sharerIdentity, sharerName, controllerIdentity, controllerName
        case agentIdentity, status, agentConnected
        case renewalDueAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sessionID = try container.decode(String.self, forKey: .sessionID)
        sharerIdentity = try container.decode(String.self, forKey: .sharerIdentity)
        sharerName = try container.decode(String.self, forKey: .sharerName)
        controllerIdentity = try container.decode(String.self, forKey: .controllerIdentity)
        controllerName = try container.decode(String.self, forKey: .controllerName)
        agentIdentity = try container.decode(String.self, forKey: .agentIdentity)
        status = try container.decode(String.self, forKey: .status)
        agentConnected = try container.decode(Bool.self, forKey: .agentConnected)
        let rawDate = try container.decode(String.self, forKey: .renewalDueAt)
        guard let date = WireDate.parse(rawDate) else {
            throw DecodingError.dataCorruptedError(forKey: .renewalDueAt, in: container, debugDescription: "Invalid ISO-8601 date")
        }
        renewalDueAt = date
    }

    public init(
        sessionID: String,
        sharerIdentity: String,
        sharerName: String,
        controllerIdentity: String,
        controllerName: String,
        agentIdentity: String,
        status: String = "awaiting-agent",
        agentConnected: Bool = false,
        renewalDueAt: Date
    ) {
        self.sessionID = sessionID
        self.sharerIdentity = sharerIdentity
        self.sharerName = sharerName
        self.controllerIdentity = controllerIdentity
        self.controllerName = controllerName
        self.agentIdentity = agentIdentity
        self.status = status
        self.agentConnected = agentConnected
        self.renewalDueAt = renewalDueAt
    }
}

public struct AgentTokenMetadata: Decodable, Equatable, Sendable {
    public let role: String
    public let room: String
    public let sessionID: String
    public let sharerIdentity: String
    public let controllerIdentity: String
    public let agentIdentity: String

    enum CodingKeys: String, CodingKey {
        case role, room
        case sessionID = "sessionId"
        case sharerIdentity, controllerIdentity, agentIdentity
    }
}

public struct RoomMetadataEnvelope: Decodable, Sendable {
    public let remoteControl: RemoteControlProjection?
}

public struct RemoteControlProjection: Decodable, Equatable, Sendable {
    public let sessionID: String
    public let status: String
    public let sharerIdentity: String
    public let sharerName: String
    public let controllerIdentity: String
    public let controllerName: String
    public let agentIdentity: String
    public let agentConnected: Bool
    public let renewalDueAt: Date

    enum CodingKeys: String, CodingKey {
        case sessionID = "sessionId"
        case status, sharerIdentity, sharerName, controllerIdentity, controllerName
        case agentIdentity, agentConnected, renewalDueAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sessionID = try container.decode(String.self, forKey: .sessionID)
        status = try container.decode(String.self, forKey: .status)
        sharerIdentity = try container.decode(String.self, forKey: .sharerIdentity)
        sharerName = try container.decode(String.self, forKey: .sharerName)
        controllerIdentity = try container.decode(String.self, forKey: .controllerIdentity)
        controllerName = try container.decode(String.self, forKey: .controllerName)
        agentIdentity = try container.decode(String.self, forKey: .agentIdentity)
        agentConnected = try container.decode(Bool.self, forKey: .agentConnected)
        let rawDate = try container.decode(String.self, forKey: .renewalDueAt)
        guard let date = WireDate.parse(rawDate) else {
            throw DecodingError.dataCorruptedError(forKey: .renewalDueAt, in: container, debugDescription: "Invalid ISO-8601 date")
        }
        renewalDueAt = date
    }

    public init(
        sessionID: String,
        status: String,
        sharerIdentity: String,
        sharerName: String,
        controllerIdentity: String,
        controllerName: String,
        agentIdentity: String,
        agentConnected: Bool,
        renewalDueAt: Date
    ) {
        self.sessionID = sessionID
        self.status = status
        self.sharerIdentity = sharerIdentity
        self.sharerName = sharerName
        self.controllerIdentity = controllerIdentity
        self.controllerName = controllerName
        self.agentIdentity = agentIdentity
        self.agentConnected = agentConnected
        self.renewalDueAt = renewalDueAt
    }
}

public struct GrantSnapshot: Equatable, Sendable {
    public let room: String
    public let sessionID: String
    public let sharerIdentity: String
    public let controllerIdentity: String
    public let agentIdentity: String
    public let renewalDueAt: Date

    public init(room: String, session: BootstrapSession) {
        self.room = room
        sessionID = session.sessionID
        sharerIdentity = session.sharerIdentity
        controllerIdentity = session.controllerIdentity
        agentIdentity = session.agentIdentity
        renewalDueAt = session.renewalDueAt
    }
}
