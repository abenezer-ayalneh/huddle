import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart';

import 'core/bootstrap_link.dart';
import 'core/control_protocol.dart';
import 'core/grant_gate.dart';
import 'core/models.dart';
import 'core/release_manifest.dart';
import 'core/server_trust.dart';
import 'livekit/livekit_session.dart';
import 'platform/windows_bridge.dart';

enum AgentPhase { waitingForLink, trustRequired, readyToConnect, connecting, chooseDisplay, awaitingActivation, readyToStart, active, switchingDisplay, ended, failed }

class WindowsControlAgent extends ChangeNotifier {
  WindowsControlAgent({LiveKitControlSession? session, ServerTrustStore? trustStore})
      : _session = session ?? LiveKitControlSession(),
        _trustStore = trustStore ?? ServerTrustStore();

  static const appVersion = '0.1.0';
  final LiveKitControlSession _session;
  final ServerTrustStore _trustStore;
  final WindowsBridge _windows = WindowsBridge.instance;
  final WindowsReleaseManifestChecker _releaseManifest = WindowsReleaseManifestChecker();
  StreamSubscription<ReceivedControlPacket>? _packetSubscription;
  StreamSubscription<String?>? _metadataSubscription;
  StreamSubscription<void>? _disconnectSubscription;
  Future<void> _inputDispatch = Future<void>.value();
  Timer? _clipboardTimer;
  Timer? _lifecycleTimer;
  BootstrapDescriptor? _descriptor;
  BootstrapResponse? _response;
  GrantGate? _gate;
  RemoteControlProjection? _projection;
  String? _displaySourceId;
  String? _displayName;
  String? _error;
  ReleaseStatus? _releaseStatus;
  AgentPhase _phase = AgentPhase.waitingForLink;
  bool _elevated = false;
  bool _elevatedLinkAccepted = false;
  bool _stopping = false;
  int _clipboardChangeCount = 0;
  int? _expectedClipboardChangeCount;
  int _clipboardRevision = 0;
  bool _clipboardSyncInFlight = false;
  bool _lifecycleCheckInFlight = false;

  AgentPhase get phase => _phase;
  String? get error => _error;
  String? get displayName => _displayName;
  Uri? get apiOrigin => _descriptor?.apiOrigin;
  bool get elevated => _elevated;
  bool get hasLink => _descriptor != null;
  bool get isSessionActive => _phase == AgentPhase.active || _phase == AgentPhase.switchingDisplay;
  ReleaseStatus? get releaseStatus => _releaseStatus;

  Future<void> initialize(String? link) async {
    _elevated = await _windows.isElevated;
    if (!await _windows.isNativeX64) {
      _setFailure('Huddle Control Agent supports native x64 Windows only. ARM64 and 32-bit Windows are not part of this beta.');
      notifyListeners();
      return;
    }
    if (!_supportsWindowsBuild(await _windows.windowsVersion)) {
      _setFailure('Huddle Control Agent requires Windows 10 22H2 or Windows 11 on a 64-bit PC.');
      notifyListeners();
      return;
    }
    await _windows.acknowledgeDisplayChange();
    if (link != null && link.isNotEmpty) await acceptLink(link);
    notifyListeners();
  }

  Future<void> acceptLink(String raw) async {
    if (_elevated && _elevatedLinkAccepted) {
      _setFailure('This elevated Control Agent accepts one launch link only. Close it and obtain a fresh browser approval.');
      return;
    }
    if (_elevated) _elevatedLinkAccepted = true;
    try {
      _descriptor = BootstrapLink.parse(raw);
      _error = null;
      _phase = await _trustStore.isTrusted(_descriptor!.apiOrigin) ? AgentPhase.readyToConnect : AgentPhase.trustRequired;
    } on BootstrapLinkException catch (error) {
      _setFailure(error.message);
    }
    notifyListeners();
  }

  Future<void> trustServer() async {
    final descriptor = _descriptor;
    if (descriptor == null) return;
    await _trustStore.trust(descriptor.apiOrigin);
    _phase = AgentPhase.readyToConnect;
    notifyListeners();
  }

  Future<void> restartElevated() async {
    final descriptor = _descriptor;
    if (descriptor == null || _session.connected) return;
    final link = 'huddle-control://join?api=${Uri.encodeQueryComponent(descriptor.apiOrigin.toString())}&room=${Uri.encodeQueryComponent(descriptor.room)}&session=${Uri.encodeQueryComponent(descriptor.sessionId)}&code=${Uri.encodeQueryComponent(descriptor.bootstrapCode)}';
    await _windows.restartElevated(link);
  }

  Future<void> connect() async {
    final descriptor = _descriptor;
    if (descriptor == null || _phase != AgentPhase.readyToConnect) return;
    _phase = AgentPhase.connecting;
    _error = null;
    notifyListeners();
    try {
      _releaseStatus = await _releaseManifest.check(appVersion, await _windows.windowsVersion);
      if (_releaseStatus!.blocking) throw const _RequiredUpdateException();
      if (_releaseStatus!.unsupportedWindows) throw const _UnsupportedWindowsException();
      final response = await _redeem(descriptor);
      if (response.room != descriptor.room || response.session.sessionId != descriptor.sessionId) throw const FormatException('The server returned a session that does not match this link.');
      final tokenMetadata = AgentTokenMetadata.fromJwt(response.token);
      if (tokenMetadata == null || tokenMetadata.room != descriptor.room || tokenMetadata.sessionId != descriptor.sessionId || tokenMetadata.agentIdentity != response.session.agentIdentity) {
        throw const FormatException('The server returned an invalid Control Agent token.');
      }
      _response = response;
      _gate = GrantGate(room: descriptor.room, bootstrap: response.session);
      await _session.connect(response);
      _packetSubscription = _session.packets.listen(_enqueuePacket);
      _metadataSubscription = _session.metadata.listen(_receiveMetadata);
      _disconnectSubscription = _session.disconnects.listen((_) => stop());
      _projection = RemoteControlProjection.fromRoomMetadata(_session.roomMetadata);
      _phase = AgentPhase.chooseDisplay;
      _startLifecycleMonitor();
    } on _RequiredUpdateException {
      await _cleanupTransport();
      _setFailure('This Control Agent version is no longer supported. Install the required update from Huddle Downloads before starting a new session.');
    } on _UnsupportedWindowsException {
      await _cleanupTransport();
      _setFailure('This Windows version does not meet the current Control Agent release requirement. Update Windows before starting a new session.');
    } catch (_) {
      await _cleanupTransport();
      _setFailure('The Control Agent could not connect. The approved link may have expired or the Huddle server is unavailable.');
    }
    notifyListeners();
  }

  Future<void> chooseDisplay(BuildContext context) async {
    if (!_session.connected || _phase == AgentPhase.active || _phase == AgentPhase.switchingDisplay) return;
    final source = await showDialog<DesktopCapturerSource>(context: context, builder: (_) => ScreenSelectDialog());
    if (source == null) return;
    if (source.type != SourceType.Screen) {
      _error = 'Choose an entire display. Window sharing is not available for Remote Control.';
      notifyListeners();
      return;
    }
    try {
      await _windows.setCaptureSource(source.id);
    } catch (_) {
      _error = 'Windows could not map that display. Select it again.';
      notifyListeners();
      return;
    }
    _displaySourceId = source.id;
    _displayName = source.name;
    _error = null;
    _phase = _canPublishNow() ? AgentPhase.readyToStart : AgentPhase.awaitingActivation;
    notifyListeners();
  }

  Future<void> start() async {
    if (_displaySourceId == null || !_canPublishNow()) return;
    _phase = AgentPhase.switchingDisplay;
    notifyListeners();
    try {
      await _session.publishSelectedDisplay(_displaySourceId!);
      _clipboardChangeCount = await _windows.clipboardChangeCount;
      _expectedClipboardChangeCount = null;
      _startClipboardMonitor();
      _phase = AgentPhase.active;
    } catch (_) {
      await _windows.releaseAll();
      await _session.unpublishDisplay();
      _phase = AgentPhase.readyToStart;
      _error = 'The selected display could not be published. Choose a display and try again.';
    }
    notifyListeners();
  }

  Future<void> switchDisplay(BuildContext context) async {
    if (_phase != AgentPhase.active) return;
    _phase = AgentPhase.switchingDisplay;
    _stopClipboardMonitor();
    await _windows.releaseAll();
    await _session.unpublishDisplay();
    _gate?.resetSequence();
    _phase = AgentPhase.chooseDisplay;
    notifyListeners();
    await chooseDisplay(context);
  }

  Future<void> stop() async {
    if (_stopping) return;
    _stopping = true;
    _phase = AgentPhase.ended;
    _stopClipboardMonitor();
    _lifecycleTimer?.cancel();
    await _windows.releaseAll();
    await _cleanupTransport();
    _stopping = false;
    notifyListeners();
    if (_elevated) exit(0);
  }

  Future<void> _receivePacket(ReceivedControlPacket received) async {
    if (_phase != AgentPhase.active || _response == null || _gate == null) return;
    final packet = ControlProtocol.decode(received.data);
    if (packet == null) return;
    final rejection = _gate!.authorize(
      packet: packet,
      senderIdentity: received.senderIdentity,
      tokenMetadata: AgentTokenMetadata.fromJwt(_response!.token),
      localAgentIdentity: _response!.session.agentIdentity,
      projection: _projection,
      connected: _session.connected,
      now: DateTime.now().toUtc(),
    );
    if (rejection != null) return;
    final command = packet.command;
    if (command is InputCommand) {
      await _windows.applyInput(command.event);
    } else if (command is ClipboardCopyCommand) {
      await _windows.releaseAll();
      await _windows.sendClipboardShortcut('copy');
    } else if (command is ClipboardPasteCommand) {
      await _windows.releaseAll();
      _expectedClipboardChangeCount = await _windows.writeClipboardText(command.text);
      _clipboardChangeCount = _expectedClipboardChangeCount!;
      await _windows.sendClipboardShortcut('paste');
    }
  }

  void _enqueuePacket(ReceivedControlPacket received) {
    _inputDispatch = _inputDispatch.then((_) async {
      try {
        await _receivePacket(received);
      } catch (_) {
        // A bridge failure may leave an OS input state uncertain. Ending the
        // attended session releases held input before any later packet can run.
        if (_phase == AgentPhase.active && await _windows.sessionState == 'display-changed') {
          await _suspendForDisplayChange();
        } else if (_phase == AgentPhase.active) {
          await stop();
        }
      }
    });
  }

  void _receiveMetadata(String? metadata) {
    _projection = RemoteControlProjection.fromRoomMetadata(metadata);
    if (_phase == AgentPhase.awaitingActivation && _canPublishNow() && _displaySourceId != null) _phase = AgentPhase.readyToStart;
    if (isSessionActive && !_canPublishNow()) unawaited(stop());
    notifyListeners();
  }

  void _startClipboardMonitor() {
    _clipboardTimer?.cancel();
    _clipboardTimer = Timer.periodic(const Duration(milliseconds: 500), (_) => _syncClipboard());
  }

  void _stopClipboardMonitor() {
    _clipboardTimer?.cancel();
    _clipboardTimer = null;
    _expectedClipboardChangeCount = null;
  }

  Future<void> _syncClipboard() async {
    if (_clipboardSyncInFlight || _phase != AgentPhase.active || !_canPublishNow() || _response == null) return;
    _clipboardSyncInFlight = true;
    try {
      if (await _windows.sessionState == 'display-changed') {
        await _suspendForDisplayChange();
        return;
      }
      final changeCount = await _windows.clipboardChangeCount;
      if (changeCount == _clipboardChangeCount) return;
      _clipboardChangeCount = changeCount;
      if (_expectedClipboardChangeCount == changeCount) {
        _expectedClipboardChangeCount = null;
        return;
      }
      final text = await _windows.readClipboardText();
      if (!ControlProtocol.isTransferableClipboardText(text) || !_canPublishNow() || _response == null) return;
      _clipboardRevision += 1;
      await _session.publishClipboardUpdate(
        controllerIdentity: _response!.session.controllerIdentity,
        sessionId: _response!.session.sessionId,
        revision: _clipboardRevision,
        text: text!,
      );
    } catch (_) {
      // A lost data channel must not leave clipboard synchronization running.
      _stopClipboardMonitor();
    } finally {
      _clipboardSyncInFlight = false;
    }
  }

  void _startLifecycleMonitor() {
    _lifecycleTimer?.cancel();
    _lifecycleTimer = Timer.periodic(const Duration(milliseconds: 250), (_) async {
      if (_lifecycleCheckInFlight) return;
      _lifecycleCheckInFlight = true;
      try {
        final state = await _windows.sessionState;
        if (state == 'display-changed') {
          if (_phase == AgentPhase.active) {
            await _suspendForDisplayChange();
          } else {
            await _windows.acknowledgeDisplayChange();
          }
        } else if (state != 'active') {
          await stop();
        }
      } finally {
        _lifecycleCheckInFlight = false;
      }
    });
  }

  Future<void> _suspendForDisplayChange() async {
    if (_phase != AgentPhase.active) return;
    _phase = AgentPhase.switchingDisplay;
    _stopClipboardMonitor();
    await _windows.releaseAll();
    await _session.unpublishDisplay();
    _gate?.resetSequence();
    _displaySourceId = null;
    _displayName = null;
    await _windows.acknowledgeDisplayChange();
    _phase = AgentPhase.chooseDisplay;
    _error = 'Your display setup changed. Select a display again before Remote Control can resume.';
    notifyListeners();
  }

  bool _canPublishNow() {
    final response = _response;
    final gate = _gate;
    if (response == null || gate == null) return false;
    return gate.canPublishDesktop(
      tokenMetadata: AgentTokenMetadata.fromJwt(response.token),
      localAgentIdentity: response.session.agentIdentity,
      projection: _projection,
      now: DateTime.now().toUtc(),
    );
  }

  Future<BootstrapResponse> _redeem(BootstrapDescriptor descriptor) async {
    final endpoint = descriptor.apiOrigin.resolve('/rooms/${Uri.encodeComponent(descriptor.room)}/remote-control/${Uri.encodeComponent(descriptor.sessionId)}/helper-token');
    final response = await http.post(endpoint, headers: const {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, body: jsonEncode({'bootstrapCode': descriptor.bootstrapCode}));
    if (response.statusCode != 200) throw const HttpException('Control Agent bootstrap rejected');
    final json = jsonDecode(response.body);
    if (json is! Map<String, dynamic>) throw const FormatException('Invalid Control Agent response');
    return BootstrapResponse.fromJson(json);
  }

  Future<void> _cleanupTransport() async {
    await _packetSubscription?.cancel();
    await _metadataSubscription?.cancel();
    await _disconnectSubscription?.cancel();
    _packetSubscription = null;
    _metadataSubscription = null;
    _disconnectSubscription = null;
    await _session.unpublishDisplay();
    await _session.disconnect();
  }

  void _setFailure(String message) {
    _phase = AgentPhase.failed;
    _error = message;
  }

  bool _supportsWindowsBuild(String value) {
    final parts = value.split('.').map(int.tryParse).toList();
    if (parts.length < 3 || parts.any((part) => part == null)) return false;
    return parts[0]! > 10 || (parts[0] == 10 && parts[1] == 0 && parts[2]! >= 19045);
  }

  @override
  void dispose() {
    _clipboardTimer?.cancel();
    _lifecycleTimer?.cancel();
    unawaited(_session.dispose());
    super.dispose();
  }
}

class _RequiredUpdateException implements Exception {
  const _RequiredUpdateException();
}

class _UnsupportedWindowsException implements Exception {
  const _UnsupportedWindowsException();
}
