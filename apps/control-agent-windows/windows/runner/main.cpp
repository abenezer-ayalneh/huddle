#include <windows.h>
#include <shellapi.h>

#include <iterator>
#include <string>

#include "flutter_window.h"
#include "utils.h"

namespace {
constexpr ULONG_PTR kHuddleControlLinkMessage = 0x48554444;  // "HUDD"

bool IsControlLink(const std::wstring& argument) {
  constexpr wchar_t kScheme[] = L"huddle-control://";
  return argument.size() >= std::size(kScheme) - 1 &&
      _wcsnicmp(argument.c_str(), kScheme, std::size(kScheme) - 1) == 0;
}

std::wstring ControlLinkFromCommandLine() {
  int argument_count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  std::wstring link;
  for (int index = 1; arguments != nullptr && index < argument_count; index += 1) {
    const std::wstring argument(arguments[index]);
    if (IsControlLink(argument)) {
      link = argument;
      break;
    }
  }
  if (arguments != nullptr) LocalFree(arguments);
  return link;
}

bool IsElevatedSessionCommand() {
  int argument_count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  bool elevated_session = false;
  for (int index = 1; arguments != nullptr && index < argument_count; index += 1) {
    if (std::wstring(arguments[index]) == L"--elevated-session") {
      elevated_session = true;
      break;
    }
  }
  if (arguments != nullptr) LocalFree(arguments);
  return elevated_session;
}

bool MatchesThisExecutable(HWND window) {
  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (process == nullptr) return false;
  wchar_t existing_path[MAX_PATH]{};
  DWORD existing_path_length = MAX_PATH;
  const bool queried = QueryFullProcessImageNameW(process, 0, existing_path, &existing_path_length);
  CloseHandle(process);
  wchar_t current_path[MAX_PATH]{};
  const DWORD current_path_length = GetModuleFileNameW(nullptr, current_path, MAX_PATH);
  return queried && current_path_length > 0 && current_path_length < MAX_PATH && _wcsicmp(existing_path, current_path) == 0;
}

bool DeliverLinkToRunningAgent(const std::wstring& link) {
  HWND window = FindWindowW(nullptr, L"Huddle Control Agent");
  if (window == nullptr || !MatchesThisExecutable(window)) return false;
  COPYDATASTRUCT data{};
  data.dwData = kHuddleControlLinkMessage;
  data.cbData = static_cast<DWORD>((link.size() + 1) * sizeof(wchar_t));
  data.lpData = const_cast<wchar_t*>(link.c_str());
  DWORD_PTR delivery_result = 0;
  const LRESULT delivered = SendMessageTimeoutW(
      window, WM_COPYDATA, 0, reinterpret_cast<LPARAM>(&data),
      SMTO_ABORTIFHUNG | SMTO_BLOCK, 1'000, &delivery_result);
  if (delivered == 0 || delivery_result != 1) return false;
  if (IsIconic(window)) ShowWindow(window, SW_RESTORE);
  else ShowWindow(window, SW_SHOW);
  SetForegroundWindow(window);
  return true;
}
}  // namespace

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE, _In_ wchar_t*, _In_ int command_show) {
  const std::wstring control_link = ControlLinkFromCommandLine();
  const bool elevated_session = IsElevatedSessionCommand();
  if (!elevated_session && !control_link.empty() && DeliverLinkToRunningAgent(control_link)) return EXIT_SUCCESS;
  HANDLE elevated_session_mutex = nullptr;
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
  Win32Window::Size size(700, 800);
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
