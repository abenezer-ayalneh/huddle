import 'control_protocol.dart';
import 'models.dart';

enum GrantRejection { disconnected, tokenMetadataMismatch, roomMetadataMissing, roomMetadataMismatch, inactive, expired, wrongSession, wrongSender, replayedSequence }

class GrantGate {
  GrantGate({required this.room, required this.bootstrap});

  final String room;
  final BootstrapSession bootstrap;
  int? _lastSequence;

  bool canPublishDesktop({required AgentTokenMetadata? tokenMetadata, required String localAgentIdentity, required RemoteControlProjection? projection, required DateTime now}) {
    return _matchesToken(tokenMetadata, localAgentIdentity) && _activeProjection(projection, now);
  }

  GrantRejection? authorize({
    required ControlPacket packet,
    required String senderIdentity,
    required AgentTokenMetadata? tokenMetadata,
    required String localAgentIdentity,
    required RemoteControlProjection? projection,
    required bool connected,
    required DateTime now,
  }) {
    if (!connected) return GrantRejection.disconnected;
    if (!_matchesToken(tokenMetadata, localAgentIdentity)) return GrantRejection.tokenMetadataMismatch;
    if (projection == null) return GrantRejection.roomMetadataMissing;
    if (!_projectionMatches(projection)) return GrantRejection.roomMetadataMismatch;
    if (projection.status != 'active' || !projection.agentConnected) return GrantRejection.inactive;
    if (!projection.renewalDueAt.isAfter(now) || bootstrap.renewalDueAt.isAfter(projection.renewalDueAt)) {
      return GrantRejection.expired;
    }
    if (packet.sessionId != bootstrap.sessionId) return GrantRejection.wrongSession;
    if (senderIdentity != bootstrap.controllerIdentity) return GrantRejection.wrongSender;
    if (_lastSequence != null && packet.sequence <= _lastSequence!) return GrantRejection.replayedSequence;
    _lastSequence = packet.sequence;
    return null;
  }

  void resetSequence() => _lastSequence = null;

  bool _matchesToken(AgentTokenMetadata? metadata, String identity) =>
      metadata != null &&
      metadata.role == 'control-agent' &&
      metadata.room == room &&
      metadata.sessionId == bootstrap.sessionId &&
      metadata.sharerIdentity == bootstrap.sharerIdentity &&
      metadata.controllerIdentity == bootstrap.controllerIdentity &&
      metadata.agentIdentity == bootstrap.agentIdentity &&
      identity == bootstrap.agentIdentity;

  bool _projectionMatches(RemoteControlProjection projection) =>
      projection.sessionId == bootstrap.sessionId &&
      projection.sharerIdentity == bootstrap.sharerIdentity &&
      projection.controllerIdentity == bootstrap.controllerIdentity &&
      projection.agentIdentity == bootstrap.agentIdentity;

  bool _activeProjection(RemoteControlProjection? projection, DateTime now) => projection != null && _projectionMatches(projection) && projection.status == 'active' && projection.agentConnected && projection.renewalDueAt.isAfter(now);
}
