import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ReleaseStatus {
  const ReleaseStatus({required this.configured, required this.blocking, required this.unsupportedWindows, this.availableVersion, this.releaseNotesUrl});
  final bool configured;
  final bool blocking;
  final bool unsupportedWindows;
  final String? availableVersion;
  final Uri? releaseNotesUrl;
}

class WindowsReleaseManifestChecker {
  WindowsReleaseManifestChecker({http.Client? client}) : _client = client ?? http.Client();

  static const _channel = String.fromEnvironment('WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL');
  static const _publicKey = String.fromEnvironment('WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY');
  static const _minimumKey = 'windows-control-agent-minimum-version-v1';
  static const _minimumWindowsKey = 'windows-control-agent-minimum-windows-v1';
  final http.Client _client;

  Future<ReleaseStatus> check(String currentVersion, String currentWindows) async {
    if (_channel.isEmpty || _publicKey.isEmpty) return const ReleaseStatus(configured: false, blocking: false, unsupportedWindows: false);
    final preferences = await SharedPreferences.getInstance();
    final cachedMinimum = preferences.getString(_minimumKey);
    final cachedMinimumWindows = preferences.getString(_minimumWindowsKey);
    try {
      final channel = Uri.parse(_channel);
      if (channel.scheme != 'https') throw const FormatException('Release channel must use HTTPS');
      final responses = await Future.wait([
        _client.get(channel.resolve('release-manifest.json'), headers: const {'Cache-Control': 'no-store'}),
        _client.get(channel.resolve('release-manifest.sig'), headers: const {'Cache-Control': 'no-store'}),
      ]);
      if (responses.any((response) => response.statusCode != 200)) throw const FormatException('Release channel is unavailable');
      final bytes = responses[0].bodyBytes;
      final manifest = _decodeManifest(bytes);
      final signature = base64.decode(responses[1].body.trim());
      final key = base64.decode(_publicKey);
      if (key.length != 32 || !(await Ed25519().verify(bytes, signature: Signature(signature, publicKey: SimplePublicKey(key, type: KeyPairType.ed25519))))) {
        throw const FormatException('Release manifest signature is invalid');
      }
      final minimum = _maxVersion(cachedMinimum, manifest.minimumSupportedVersion);
      final minimumWindows = _maxWindowsVersion(cachedMinimumWindows, manifest.minimumWindows);
      await preferences.setString(_minimumKey, minimum);
      await preferences.setString(_minimumWindowsKey, minimumWindows);
      return ReleaseStatus(
        configured: true,
        blocking: _compareVersions(currentVersion, minimum) < 0,
        unsupportedWindows: _compareWindowsVersions(currentWindows, minimumWindows) < 0,
        availableVersion: _compareVersions(manifest.version, currentVersion) > 0 ? manifest.version : null,
        releaseNotesUrl: manifest.releaseNotesUrl,
      );
    } catch (_) {
      return ReleaseStatus(
        configured: true,
        blocking: cachedMinimum != null && _compareVersions(currentVersion, cachedMinimum) < 0,
        unsupportedWindows: cachedMinimumWindows != null && _compareWindowsVersions(currentWindows, cachedMinimumWindows) < 0,
      );
    }
  }

  _WindowsManifest _decodeManifest(Uint8List bytes) {
    final decoded = jsonDecode(utf8.decode(bytes));
    if (decoded is! Map<String, dynamic> || decoded['schemaVersion'] != 1 || decoded['channel'] != 'beta') throw const FormatException('Invalid release manifest');
    final downloads = decoded['downloads'];
    if (downloads is! Map<String, dynamic> || downloads['x64'] is! Map<String, dynamic>) throw const FormatException('Invalid release artifact');
    final x64 = downloads['x64'] as Map<String, dynamic>;
    final version = _version(decoded['version']);
    final minimum = _version(decoded['minimumSupportedVersion']);
    final minimumWindows = _windowsVersion(decoded['minimumWindows']);
    final releaseNotesUrl = Uri.tryParse(decoded['releaseNotesUrl'] as String? ?? '');
    final artifact = Uri.tryParse(x64['url'] as String? ?? '');
    if (releaseNotesUrl == null || releaseNotesUrl.scheme != 'https' || artifact == null || artifact.scheme != 'https' || x64['sha256'] is! String || !RegExp(r'^[A-Fa-f0-9]{64}$').hasMatch(x64['sha256'] as String)) {
      throw const FormatException('Invalid release manifest');
    }
    return _WindowsManifest(version: version, minimumSupportedVersion: minimum, minimumWindows: minimumWindows, releaseNotesUrl: releaseNotesUrl);
  }

  String _maxVersion(String? left, String right) => left == null || _compareVersions(left, right) < 0 ? right : left;
  String _maxWindowsVersion(String? left, String right) => left == null || _compareWindowsVersions(left, right) < 0 ? right : left;
  String _version(Object? value) {
    if (value is! String || !RegExp(r'^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$').hasMatch(value)) throw const FormatException('Invalid semantic version');
    return value;
  }

  String _windowsVersion(Object? value) {
    if (value is! String || !RegExp(r'^10\.0\.\d{5,}$').hasMatch(value)) throw const FormatException('Invalid Windows version');
    return value;
  }
}

class _WindowsManifest {
  const _WindowsManifest({required this.version, required this.minimumSupportedVersion, required this.minimumWindows, required this.releaseNotesUrl});
  final String version;
  final String minimumSupportedVersion;
  final String minimumWindows;
  final Uri releaseNotesUrl;
}

int _compareVersions(String left, String right) {
  List<int> core(String value) => value.split(RegExp(r'[-+]')).first.split('.').map(int.parse).toList();
  final l = core(left);
  final r = core(right);
  for (var index = 0; index < 3; index += 1) {
    if (l[index] != r[index]) return l[index].compareTo(r[index]);
  }
  final leftPre = left.contains('-');
  final rightPre = right.contains('-');
  if (leftPre != rightPre) return leftPre ? -1 : 1;
  return 0;
}

int _compareWindowsVersions(String left, String right) {
  List<int> parts(String value) => value.split('.').map(int.parse).toList();
  final l = parts(left);
  final r = parts(right);
  for (var index = 0; index < 3; index += 1) {
    if (l[index] != r[index]) return l[index].compareTo(r[index]);
  }
  return 0;
}
