import 'models.dart';

class BootstrapLinkException implements Exception {
  const BootstrapLinkException(this.message);
  final String message;
  @override
  String toString() => message;
}

class BootstrapLink {
  static BootstrapDescriptor parse(String raw) {
    final link = Uri.tryParse(raw);
    if (link == null || link.scheme.toLowerCase() != 'huddle-control') throw const BootstrapLinkException('This is not a Huddle Control Agent link.');
    if (link.host.toLowerCase() != 'join' || (link.path.isNotEmpty && link.path != '/') || link.fragment.isNotEmpty || link.userInfo.isNotEmpty) {
      throw const BootstrapLinkException('The Control Agent link action is invalid.');
    }
    final values = <String, String>{};
    for (final entry in link.queryParametersAll.entries) {
      if (!{'api', 'room', 'session', 'code'}.contains(entry.key) || entry.value.length != 1) continue;
      values[entry.key] = entry.value.single;
    }
    if (values.length != 4) throw const BootstrapLinkException('The Control Agent link is incomplete or repeats a parameter.');
    final api = _validateApiOrigin(values['api']!);
    if (!_identifier(values['room']!) || !_identifier(values['session']!)) throw const BootstrapLinkException('The room or Remote Control session is invalid.');
    if (!_identifier(values['code']!, max: 512) || values['code']!.length < 8) throw const BootstrapLinkException('The bootstrap code is invalid or expired.');
    return BootstrapDescriptor(apiOrigin: api, room: values['room']!, sessionId: values['session']!, bootstrapCode: values['code']!);
  }

  static Uri _validateApiOrigin(String raw) {
    final api = Uri.tryParse(raw);
    if (api == null || api.host.isEmpty || api.userInfo.isNotEmpty || api.query.isNotEmpty || api.fragment.isNotEmpty || (api.path.isNotEmpty && api.path != '/')) {
      throw const BootstrapLinkException('The API address is invalid.');
    }
    final local = api.host == 'localhost' || api.host == '127.0.0.1' || api.host == '::1' || api.host.endsWith('.localhost');
    if (api.scheme != 'https' && !(api.scheme == 'http' && local)) throw const BootstrapLinkException('The API address must use HTTPS (or localhost for development).');
    return api.replace(path: '', query: null, fragment: null);
  }

  static bool _identifier(String value, {int max = 128}) => RegExp(r'^[A-Za-z0-9_-]{1,}$').hasMatch(value) && value.length <= max;
}
