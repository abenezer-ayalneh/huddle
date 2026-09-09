import 'package:flutter_test/flutter_test.dart';
import 'package:huddle_control_agent_windows/core/control_protocol.dart';
import 'package:huddle_control_agent_windows/core/grant_gate.dart';
import 'package:huddle_control_agent_windows/core/models.dart';

void main() {
  final due = DateTime.utc(2030, 1, 1);
  final session = BootstrapSession(
    sessionId: 'session',
    sharerIdentity: 'sharer',
    sharerName: 'Ada',
    controllerIdentity: 'controller',
    controllerName: 'Bo',
    agentIdentity: 'control-agent:session',
    status: 'awaiting-agent',
    agentConnected: false,
    renewalDueAt: due,
  );
  const token = AgentTokenMetadata(
    role: 'control-agent',
    room: 'room',
    sessionId: 'session',
    sharerIdentity: 'sharer',
    controllerIdentity: 'controller',
    agentIdentity: 'control-agent:session',
  );
  final projection = RemoteControlProjection(
    sessionId: 'session',
    status: 'active',
    sharerIdentity: 'sharer',
    controllerIdentity: 'controller',
    agentIdentity: 'control-agent:session',
    agentConnected: true,
    renewalDueAt: due,
  );

  test('binds publication and packets to the active server grant', () {
    final gate = GrantGate(room: 'room', bootstrap: session);
    expect(
        gate.canPublishDesktop(
            tokenMetadata: token,
            localAgentIdentity: 'control-agent:session',
            projection: projection,
            now: DateTime.utc(2029)),
        isTrue);
    const packet = ControlPacket(
        sessionId: 'session',
        sequence: 1,
        command: InputCommand({'kind': 'move', 'x': 0.5, 'y': 0.5}));
    expect(
      gate.authorize(
          packet: packet,
          senderIdentity: 'controller',
          tokenMetadata: token,
          localAgentIdentity: 'control-agent:session',
          projection: projection,
          connected: true,
          now: DateTime.utc(2029)),
      isNull,
    );
    expect(
      gate.authorize(
          packet: packet,
          senderIdentity: 'controller',
          tokenMetadata: token,
          localAgentIdentity: 'control-agent:session',
          projection: projection,
          connected: true,
          now: DateTime.utc(2029)),
      GrantRejection.replayedSequence,
    );
  });

  test('rejects wrong sender, mismatched room token, and expired projection',
      () {
    const packet = ControlPacket(
        sessionId: 'session', sequence: 1, command: ClipboardCopyCommand());
    expect(
      GrantGate(room: 'room', bootstrap: session).authorize(
          packet: packet,
          senderIdentity: 'forged',
          tokenMetadata: token,
          localAgentIdentity: 'control-agent:session',
          projection: projection,
          connected: true,
          now: DateTime.utc(2029)),
      GrantRejection.wrongSender,
    );
    const wrongRoom = AgentTokenMetadata(
        role: 'control-agent',
        room: 'other',
        sessionId: 'session',
        sharerIdentity: 'sharer',
        controllerIdentity: 'controller',
        agentIdentity: 'control-agent:session');
    expect(
        GrantGate(room: 'room', bootstrap: session).canPublishDesktop(
            tokenMetadata: wrongRoom,
            localAgentIdentity: 'control-agent:session',
            projection: projection,
            now: DateTime.utc(2029)),
        isFalse);
    final expired = RemoteControlProjection(
        sessionId: 'session',
        status: 'active',
        sharerIdentity: 'sharer',
        controllerIdentity: 'controller',
        agentIdentity: 'control-agent:session',
        agentConnected: true,
        renewalDueAt: DateTime.utc(2020));
    expect(
      GrantGate(room: 'room', bootstrap: session).authorize(
          packet: packet,
          senderIdentity: 'controller',
          tokenMetadata: token,
          localAgentIdentity: 'control-agent:session',
          projection: expired,
          connected: true,
          now: DateTime.utc(2029)),
      GrantRejection.expired,
    );
  });
}
