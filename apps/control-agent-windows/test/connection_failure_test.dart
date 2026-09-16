import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:huddle_control_agent_windows/core/connection_failure.dart';

void main() {
  test('classifies an expired or reused bootstrap without exposing its code',
      () {
    final message = safeConnectionFailureMessage(
      AgentConnectionStage.bootstrapRedemption,
      const BootstrapRedemptionException(401),
    );

    expect(message, contains('rejected or has expired'));
    expect(message, isNot(contains('401')));
  });

  test('reports secure-network failures without forwarding native error text',
      () {
    final message = safeConnectionFailureMessage(
      AgentConnectionStage.livekitConnection,
      const SocketException('private network detail'),
    );

    expect(message, contains('could not reach the Huddle server'));
    expect(message, isNot(contains('private network detail')));
  });

  test('retains the safe stage label for copied diagnostics', () {
    expect(
      AgentConnectionStage.livekitConnection.diagnosticLabel,
      'livekit-connection',
    );
  });
}
