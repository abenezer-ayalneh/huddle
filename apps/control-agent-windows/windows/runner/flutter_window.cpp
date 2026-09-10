#include "flutter_window.h"

#include <windows.h>
#include <wtsapi32.h>

#include <flutter/generated_plugin_registrant.h>

FlutterWindow::FlutterWindow(const wchar_t* title) : Win32Window(), project_(L"data") {}
FlutterWindow::~FlutterWindow() = default;

bool FlutterWindow::OnCreate() {
  if (!Win32Window::OnCreate()) return false;
  RECT frame = GetClientArea();
  flutter_controller_ = std::make_unique<flutter::FlutterViewController>(frame.right - frame.left, frame.bottom - frame.top, project_);
  if (!flutter_controller_->engine() || !flutter_controller_->view()) return false;
  RegisterPlugins(flutter_controller_->engine());
  control_bridge_.RegisterWith(flutter_controller_->engine()->GetRegistrarForPlugin("HuddleControlAgentWindows"));
  SetChildContent(flutter_controller_->view()->GetNativeWindow());
  WTSRegisterSessionNotification(GetHandle(), NOTIFY_FOR_THIS_SESSION);
  return true;
}

void FlutterWindow::OnDestroy() {
  WTSUnRegisterSessionNotification(GetHandle());
  flutter_controller_.reset();
  Win32Window::OnDestroy();
}

LRESULT FlutterWindow::MessageHandler(HWND window, UINT const message, WPARAM const wparam, LPARAM const lparam) noexcept {
  if (message == WM_WTSSESSION_CHANGE && (wparam == WTS_SESSION_LOCK || wparam == WTS_SESSION_LOGOFF || wparam == WTS_REMOTE_DISCONNECT)) {
    control_bridge_.SetSessionState("inactive");
  }
  if (message == WM_POWERBROADCAST && wparam == PBT_APMSUSPEND) control_bridge_.SetSessionState("inactive");
  if (message == WM_DISPLAYCHANGE) control_bridge_.SetSessionState("display-changed");
  if (flutter_controller_) {
    auto hwnd = flutter_controller_->view()->GetNativeWindow();
    if (message == WM_SIZE) ::SetWindowPos(hwnd, nullptr, 0, 0, LOWORD(lparam), HIWORD(lparam), SWP_NOZORDER | SWP_NOACTIVATE);
  }
  return Win32Window::MessageHandler(window, message, wparam, lparam);
}
