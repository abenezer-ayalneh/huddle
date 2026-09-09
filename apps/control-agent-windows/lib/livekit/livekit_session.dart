import 'dart:async';
import 'dart:typed_data';

import 'package:livekit_client/livekit_client.dart';

import '../core/control_protocol.dart';
import '../core/models.dart';

class ReceivedControlPacket {
  const ReceivedControlPacket({required this.data, required this.senderIdentity});
  final List<int> data;
  final String senderIdentity;
}

class LiveKitControlSession {
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  LocalTrackPublication? _screenPublication;
  final _packets = StreamController<ReceivedControlPacket>.broadcast();
  final _metadata = StreamController<String?>.broadcast();
  final _disconnects = StreamController<void>.broadcast();

  Stream<ReceivedControlPacket> get packets => _packets.stream;
  Stream<String?> get metadata => _metadata.stream;
  Stream<void> get disconnects => _disconnects.stream;
  bool get connected => _room != null;
  String? get roomMetadata => _room?.metadata;

  Future<void> connect(BootstrapResponse response) async {
    if (_room != null) throw StateError('Control Agent is already connected');
    final room = Room();
    _listener = room.createListener()
      ..on<DataReceivedEvent>((event) {
        if (event.topic != remoteControlTopic || event.participant == null) return;
        _packets.add(ReceivedControlPacket(data: event.data, senderIdentity: event.participant!.identity));
      })
      ..on<RoomMetadataChangedEvent>((event) => _metadata.add(event.metadata))
      ..on<RoomDisconnectedEvent>((_) => _disconnects.add(null));
    await room.connect(response.livekitUrl, response.token, roomOptions: const RoomOptions(adaptiveStream: false, dynacast: false));
    _room = room;
    _metadata.add(room.metadata);
  }

  Future<void> publishSelectedDisplay(String sourceId) async {
    final room = _room;
    if (room == null) throw StateError('Control Agent is not connected');
    await unpublishDisplay();
    final track = await LocalVideoTrack.createScreenShareTrack(ScreenShareCaptureOptions(sourceId: sourceId, captureScreenAudio: false, maxFrameRate: 15));
    _screenPublication = await room.localParticipant.publishVideoTrack(track);
  }

  Future<void> unpublishDisplay() async {
    final room = _room;
    final publication = _screenPublication;
    _screenPublication = null;
    if (room != null && publication != null) await room.localParticipant.unpublishTrack(publication.sid);
  }

  Future<void> publishClipboardUpdate({required String controllerIdentity, required String sessionId, required int revision, required String text}) async {
    final room = _room;
    if (room == null) throw StateError('Control Agent is not connected');
    await room.localParticipant.publishData(
      Uint8List.fromList(ControlProtocol.clipboardUpdate(sessionId: sessionId, revision: revision, text: text)),
      reliable: true,
      topic: remoteControlTopic,
      destinationIdentities: [controllerIdentity],
    );
  }

  Future<void> disconnect() async {
    final room = _room;
    _room = null;
    _screenPublication = null;
    _listener?.dispose();
    _listener = null;
    if (room != null) {
      await room.disconnect();
      await room.dispose();
    }
  }

  Future<void> dispose() async {
    await disconnect();
    await _packets.close();
    await _metadata.close();
    await _disconnects.close();
  }
}
