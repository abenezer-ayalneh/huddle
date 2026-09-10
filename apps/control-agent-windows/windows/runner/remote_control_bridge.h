#ifndef RUNNER_REMOTE_CONTROL_BRIDGE_H_
#define RUNNER_REMOTE_CONTROL_BRIDGE_H_

#include <memory>
#include <string>
#include <vector>

#include <flutter/method_channel.h>
#include <flutter/plugin_registrar_windows.h>
#include <flutter/standard_method_codec.h>

class RemoteControlBridge {
 public:
  void RegisterWith(flutter::PluginRegistrarWindows* registrar);
  void SetSessionState(const std::string& state);

 private:
  void HandleMethodCall(const flutter::MethodCall<flutter::EncodableValue>& call, std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);
  bool SetCaptureSource(const std::string& source_id, std::string* error);
  bool ApplyInput(const flutter::EncodableMap& event, std::string* error);
  bool ReleaseAll();
  bool IsElevated() const;
  std::string NativeArchitecture() const;
  std::string WindowsVersion() const;
  int ClipboardChangeCount() const;
  bool ReadClipboard(std::wstring* value) const;
  bool WriteClipboard(const std::wstring& value) const;
  bool RelaunchElevated(const std::wstring& link, std::string* error) const;
  std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> channel_;
  RECT selected_display_{0, 0, 0, 0};
  std::string session_state_ = "active";
  double vertical_remainder_ = 0;
  double horizontal_remainder_ = 0;
  std::vector<WORD> pressed_keys_;
};

#endif  // RUNNER_REMOTE_CONTROL_BRIDGE_H_
