import 'package:shared_preferences/shared_preferences.dart';

class ServerTrustStore {
  static const _key = 'trusted-api-origins-v1';

  Future<bool> isTrusted(Uri origin) async {
    final values = (await SharedPreferences.getInstance()).getStringList(_key) ?? const [];
    return values.contains(_normalized(origin));
  }

  Future<void> trust(Uri origin) async {
    final prefs = await SharedPreferences.getInstance();
    final normalized = _normalized(origin);
    final values = (prefs.getStringList(_key) ?? const []).where((value) => value != normalized).toList()..add(normalized);
    await prefs.setStringList(_key, values);
  }

  Future<void> forget(Uri origin) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, (prefs.getStringList(_key) ?? const []).where((value) => value != _normalized(origin)).toList());
  }

  String _normalized(Uri origin) => origin.replace(path: '', query: null, fragment: null).toString().replaceFirst(RegExp(r'/$'), '');
}
