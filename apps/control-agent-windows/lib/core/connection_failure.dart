import 'dart:async';
import 'dart:io';

// Keep connection feedback useful without ever copying an approved link, its
// bearer code, a token, or a server-provided error body into the UI/clipboard.
enum AgentConnectionStage {
  releaseManifest,
  bootstrapRedemption,
  responseValidation,
  livekitConnection,
}

extension AgentConnectionStageLabel on AgentConnectionStage {
  String get diagnosticLabel => switch (this) {
        AgentConnectionStage.releaseManifest => 'release-manifest',
        AgentConnectionStage.bootstrapRedemption => 'bootstrap-redemption',
        AgentConnectionStage.responseValidation => 'response-validation',
        AgentConnectionStage.livekitConnection => 'livekit-connection',
      };
}

class BootstrapRedemptionException implements Exception {
  const BootstrapRedemptionException(this.statusCode);

  final int statusCode;
}

String safeConnectionFailureMessage(
  AgentConnectionStage stage,
  Object error,
) {
  if (error is BootstrapRedemptionException) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return 'This approved link was rejected or has expired. Return to the Huddle room and choose Open Agent to create a fresh link.';
    }
    return 'Huddle could not prepare this Control Agent session. Check the Huddle server, then request a new approval.';
  }
  if (error is HandshakeException) {
    return 'Windows could not verify Huddle’s secure connection. Check the computer clock and the Huddle server certificate, then try a fresh link.';
  }
  if (error is SocketException) {
    return 'Windows could not reach the Huddle server. Check this computer’s network connection, then return to the room and create a fresh link.';
  }
  if (error is TimeoutException) {
    return 'The Huddle connection timed out. Check the network, then return to the room and create a fresh link.';
  }

  return switch (stage) {
    AgentConnectionStage.releaseManifest =>
      'This Control Agent could not verify its release configuration. Check the network or install the current build from Huddle Downloads.',
    AgentConnectionStage.bootstrapRedemption =>
      'The approved link could not be redeemed. Return to the Huddle room and choose Open Agent to create a fresh link.',
    AgentConnectionStage.responseValidation =>
      'Huddle returned an invalid Control Agent session. Return to the room and request a new approval.',
    AgentConnectionStage.livekitConnection =>
      'The Control Agent reached Huddle but could not join the meeting. Check the network or firewall, then return to the room and create a fresh link.',
  };
}
