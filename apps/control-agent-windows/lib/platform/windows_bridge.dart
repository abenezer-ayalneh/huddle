import 'package:flutter/services.dart';

class WindowsBridge {
  WindowsBridge._();
  static final instance = WindowsBridge._();
  static const _channel = MethodChannel('com.huddle.control-agent/windows');

  Future<void> configureDpiAwareness() => _channel.invokeMethod<void>('configureDpiAwareness');
  Future<bool> get isElevated async => (await _channel.invokeMethod<bool>('isElevated')) ?? false;
  Future<bool> get isNativeX64 async => (await _channel.invokeMethod<bool>('isNativeX64')) ?? false;
  Future<String> get windowsVersion async => (await _channel.invokeMethod<String>('windowsVersion')) ?? '0.0.0';
  Future<void> restartElevated(String link) => _channel.invokeMethod<void>('restartElevated', {'link': link});
  Future<void> setCaptureSource(String sourceId) => _channel.invokeMethod<void>('setCaptureSource', {'sourceId': sourceId});
  Future<void> applyInput(Map<String, dynamic> event) => _channel.invokeMethod<void>('applyInput', event);
  Future<void> releaseAll() => _channel.invokeMethod<void>('releaseAll');
  Future<void> sendClipboardShortcut(String action) => _channel.invokeMethod<void>('sendClipboardShortcut', {'action': action});
  Future<int> get clipboardChangeCount async => (await _channel.invokeMethod<int>('clipboardChangeCount')) ?? 0;
  Future<String?> readClipboardText() => _channel.invokeMethod<String>('readClipboardText');
  Future<int> writeClipboardText(String text) async => (await _channel.invokeMethod<int>('writeClipboardText', {'text': text})) ?? 0;
  Future<String> get sessionState async => (await _channel.invokeMethod<String>('sessionState')) ?? 'active';
  Future<void> acknowledgeDisplayChange() => _channel.invokeMethod<void>('acknowledgeDisplayChange');
}
