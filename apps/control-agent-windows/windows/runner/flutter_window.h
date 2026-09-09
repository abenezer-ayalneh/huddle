#ifndef RUNNER_FLUTTER_WINDOW_H_
#define RUNNER_FLUTTER_WINDOW_H_

#include <memory>

#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <flutter_win32_window.h>

#include "remote_control_bridge.h"

class FlutterWindow : public Win32Window {
 public:
  explicit FlutterWindow(const wchar_t* title);
  ~FlutterWindow() override;

 protected:
  bool OnCreate() override;
  void OnDestroy() override;
  LRESULT MessageHandler(HWND window, UINT const message, WPARAM const wparam, LPARAM const lparam) noexcept override;

 private:
  flutter::DartProject project_;
  std::unique_ptr<flutter::FlutterViewController> flutter_controller_;
  RemoteControlBridge control_bridge_;
};

#endif  // RUNNER_FLUTTER_WINDOW_H_
