import 'dart:convert';

class BootstrapDescriptor {
  const BootstrapDescriptor({required this.apiOrigin, required this.room, required this.sessionId, required this.bootstrapCode});

  final Uri apiOrigin;
  final String room;
  final String sessionId;
  final String bootstrapCode;
}

class BootstrapSession {
  const BootstrapSession({
    required this.sessionId,
    required this.sharerIdentity,
    required this.sharerName,
    required this.controllerIdentity,
    required this.controllerName,
    required this.agentIdentity,
    required this.status,
    required this.agentConnected,
    required this.renewalDueAt,
  });

  final String sessionId;
  final String sharerIdentity;
  final String sharerName;
  final String controllerIdentity;
  final String controllerName;
  final String agentIdentity;
  final String status;
  final bool agentConnected;
  final DateTime renewalDueAt;

  factory BootstrapSession.fromJson(Map<String, dynamic> json) => BootstrapSession(
        sessionId: _requiredString(json, 'sessionId'),
        sharerIdentity: _requiredString(json, 'sharerIdentity'),
        sharerName: _requiredString(json, 'sharerName'),
        controllerIdentity: _requiredString(json, 'controllerIdentity'),
        controllerName: _requiredString(json, 'controllerName'),
        agentIdentity: _requiredString(json, 'agentIdentity'),
        status: _requiredString(json, 'status'),
        agentConnected: json['agentConnected'] == true,
        renewalDueAt: DateTime.parse(_requiredString(json, 'renewalDueAt')).toUtc(),
      );
}

class BootstrapResponse {
  const BootstrapResponse({required this.token, required this.livekitUrl, required this.room, required this.session});

  final String token;
  final String livekitUrl;
  final String room;
  final BootstrapSession session;

  factory BootstrapResponse.fromJson(Map<String, dynamic> json) => BootstrapResponse(
        token: _requiredString(json, 'token'),
        livekitUrl: _requiredString(json, 'livekitUrl'),
        room: _requiredString(json, 'room'),
        session: BootstrapSession.fromJson(_requiredMap(json, 'session')),
      );
}

class AgentTokenMetadata {
  const AgentTokenMetadata({
    required this.role,
    required this.room,
    required this.sessionId,
    required this.sharerIdentity,
    required this.controllerIdentity,
    required this.agentIdentity,
  });

  final String role;
  final String room;
  final String sessionId;
  final String sharerIdentity;
  final String controllerIdentity;
  final String agentIdentity;

  static AgentTokenMetadata? fromJwt(String token) {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)));
      if (payload is! Map<String, dynamic>) return null;
      final metadata = payload['metadata'];
      if (metadata is! String || metadata.length > 2048) return null;
      final decoded = jsonDecode(metadata);
      if (decoded is! Map<String, dynamic>) return null;
      return AgentTokenMetadata(
        role: _requiredString(decoded, 'role'),
        room: _requiredString(decoded, 'room'),
        sessionId: _requiredString(decoded, 'sessionId'),
        sharerIdentity: _requiredString(decoded, 'sharerIdentity'),
        controllerIdentity: _requiredString(decoded, 'controllerIdentity'),
        agentIdentity: _requiredString(decoded, 'agentIdentity'),
      );
    } catch (_) {
      return null;
    }
  }
}

class RemoteControlProjection {
  const RemoteControlProjection({
    required this.sessionId,
    required this.status,
    required this.sharerIdentity,
    required this.controllerIdentity,
    required this.agentIdentity,
    required this.agentConnected,
    required this.renewalDueAt,
  });

  final String sessionId;
  final String status;
  final String sharerIdentity;
  final String controllerIdentity;
  final String agentIdentity;
  final bool agentConnected;
  final DateTime renewalDueAt;

  static RemoteControlProjection? fromRoomMetadata(String? metadata) {
    if (metadata == null || metadata.length > 64000) return null;
    try {
      final root = jsonDecode(metadata);
      if (root is! Map<String, dynamic> || root['remoteControl'] is! Map<String, dynamic>) return null;
      final json = root['remoteControl'] as Map<String, dynamic>;
      return RemoteControlProjection(
        sessionId: _requiredString(json, 'sessionId'),
        status: _requiredString(json, 'status'),
        sharerIdentity: _requiredString(json, 'sharerIdentity'),
        controllerIdentity: _requiredString(json, 'controllerIdentity'),
        agentIdentity: _requiredString(json, 'agentIdentity'),
        agentConnected: json['agentConnected'] == true,
        renewalDueAt: DateTime.parse(_requiredString(json, 'renewalDueAt')).toUtc(),
      );
    } catch (_) {
      return null;
    }
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty || value.length > 512) throw const FormatException('Invalid Control Agent response');
  return value;
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map<String, dynamic>) throw const FormatException('Invalid Control Agent response');
  return value;
}
