import Foundation

public struct BootstrapDescriptor: Equatable, Sendable {
    public let apiOrigin: URL
    public let room: String
    public let sessionID: String
    public let bootstrapCode: String

    public init(apiOrigin: URL, room: String, sessionID: String, bootstrapCode: String) {
        self.apiOrigin = apiOrigin
        self.room = room
        self.sessionID = sessionID
        self.bootstrapCode = bootstrapCode
    }
}

public enum BootstrapLinkError: LocalizedError, Equatable {
    case invalidScheme
    case invalidAction
    case invalidAPIOrigin
    case invalidRoom
    case invalidSession
    case invalidCode
    case duplicateParameter(String)

    public var errorDescription: String? {
        switch self {
        case .invalidScheme: "This is not a Huddle Control Agent link."
        case .invalidAction: "The Control Agent link action is invalid."
        case .invalidAPIOrigin: "The API address must use HTTPS (or localhost for development)."
        case .invalidRoom: "The Room Code is invalid."
        case .invalidSession: "The Remote Control session is invalid."
        case .invalidCode: "The bootstrap code is invalid or expired."
        case let .duplicateParameter(name): "The Control Agent link repeats the \(name) parameter."
        }
    }
}

public enum BootstrapLink {
    private static func validIdentifier(_ value: String, max: Int = 128) -> Bool {
        !value.isEmpty && value.count <= max && value.unicodeScalars.allSatisfy { scalar in
            scalar.value == 45 || scalar.value == 95 || (48 ... 57).contains(scalar.value) || (65 ... 90).contains(scalar.value) || (97 ... 122).contains(scalar.value)
        }
    }

    public static func parse(_ url: URL) throws -> BootstrapDescriptor {
        guard url.scheme?.lowercased() == "huddle-control" else {
            throw BootstrapLinkError.invalidScheme
        }
        guard url.host?.lowercased() == "join", url.path.isEmpty || url.path == "/" else {
            throw BootstrapLinkError.invalidAction
        }
        guard url.user == nil, url.password == nil, url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            throw BootstrapLinkError.invalidAction
        }

        let values = try uniqueQueryValues(components.queryItems ?? [])
        guard let apiText = values["api"], let apiURL = URL(string: apiText) else {
            throw BootstrapLinkError.invalidAPIOrigin
        }
        let apiOrigin = try validateAPIOrigin(apiURL)

        guard let room = values["room"], validIdentifier(room) else {
            throw BootstrapLinkError.invalidRoom
        }
        guard let sessionID = values["session"], validIdentifier(sessionID) else {
            throw BootstrapLinkError.invalidSession
        }
        guard let code = values["code"], validIdentifier(code, max: 512), code.count >= 8 else {
            throw BootstrapLinkError.invalidCode
        }

        return BootstrapDescriptor(apiOrigin: apiOrigin, room: room, sessionID: sessionID, bootstrapCode: code)
    }

    public static func manual(api: String, room: String, sessionID: String, code: String) throws -> BootstrapDescriptor {
        var components = URLComponents()
        components.scheme = "huddle-control"
        components.host = "join"
        components.queryItems = [
            URLQueryItem(name: "api", value: api),
            URLQueryItem(name: "room", value: room),
            URLQueryItem(name: "session", value: sessionID),
            URLQueryItem(name: "code", value: code),
        ]
        guard let url = components.url else { throw BootstrapLinkError.invalidAction }
        return try parse(url)
    }

    public static func commandLine(arguments: [String]) throws -> BootstrapDescriptor? {
        guard arguments.count > 1 else { return nil }
        if let linkIndex = arguments.firstIndex(of: "--link"), arguments.indices.contains(linkIndex + 1),
           let url = URL(string: arguments[linkIndex + 1])
        {
            return try parse(url)
        }

        func value(after flag: String) -> String? {
            guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
            return arguments[index + 1]
        }
        let supplied = ["--api", "--room", "--session", "--code"].contains { arguments.contains($0) }
        guard supplied else { return nil }
        guard let api = value(after: "--api"), let room = value(after: "--room"),
              let session = value(after: "--session"), let code = value(after: "--code")
        else {
            throw BootstrapLinkError.invalidAction
        }
        return try manual(api: api, room: room, sessionID: session, code: code)
    }

    private static func uniqueQueryValues(_ items: [URLQueryItem]) throws -> [String: String] {
        var result: [String: String] = [:]
        for item in items {
            guard ["api", "room", "session", "code"].contains(item.name), let value = item.value else { continue }
            guard result[item.name] == nil else { throw BootstrapLinkError.duplicateParameter(item.name) }
            result[item.name] = value
        }
        return result
    }

    private static func validateAPIOrigin(_ url: URL) throws -> URL {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased(), let host = components.host?.lowercased(),
              !host.isEmpty, components.user == nil, components.password == nil,
              components.query == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/"
        else {
            throw BootstrapLinkError.invalidAPIOrigin
        }
        let isLocal = host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".localhost")
        guard scheme == "https" || (scheme == "http" && isLocal) else {
            throw BootstrapLinkError.invalidAPIOrigin
        }
        var normalized = components
        normalized.scheme = scheme
        normalized.host = host
        normalized.path = ""
        guard let result = normalized.url else { throw BootstrapLinkError.invalidAPIOrigin }
        return result
    }
}
