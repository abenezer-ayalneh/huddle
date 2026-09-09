#include <windows.h>
#include <shellapi.h>

#include <string>

#include "flutter_window.h"
#include "utils.h"

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE, _In_ wchar_t*, _In_ int command_show) {
  HANDLE elevated_session_mutex = nullptr;
  int argument_count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  bool elevated_session = false;
  for (int index = 1; arguments != nullptr && index < argument_count; index += 1) {
    if (std::wstring(arguments[index]) == L"--elevated-session") elevated_session = true;
  }
  if (arguments != nullptr) LocalFree(arguments);
  if (elevated_session) {
    elevated_session_mutex = CreateMutexW(nullptr, TRUE, L"Local\\HuddleControlAgentElevatedSession");
    const DWORD mutex_error = GetLastError();
    if (elevated_session_mutex == nullptr || mutex_error == ERROR_ALREADY_EXISTS) {
      if (elevated_session_mutex != nullptr) {
        CloseHandle(elevated_session_mutex);
      }
      return EXIT_SUCCESS;
    }
  }

  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  FlutterWindow window(L"Huddle Control Agent");
  Win32Window::Point origin(10, 10);
  Win32Window::Size size(760, 760);
  if (!window.Create(L"Huddle Control Agent", origin, size)) return EXIT_FAILURE;
  window.SetQuitOnClose(true);
  window.Show();

  ::MSG message;
  while (::GetMessage(&message, nullptr, 0, 0)) {
    ::TranslateMessage(&message);
    ::DispatchMessage(&message);
  }
  ::CoUninitialize();
  if (elevated_session_mutex != nullptr) {
    ReleaseMutex(elevated_session_mutex);
    CloseHandle(elevated_session_mutex);
  }
  return EXIT_SUCCESS;
}
