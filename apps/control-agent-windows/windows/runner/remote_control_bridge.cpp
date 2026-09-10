#include "remote_control_bridge.h"

#include <shellapi.h>
#include <windows.h>

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <cwchar>
#include <map>
#include <optional>
#include <utility>

namespace {

const flutter::EncodableValue* Field(const flutter::EncodableMap& map, const char* key) {
  const auto it = map.find(flutter::EncodableValue(key));
  return it == map.end() ? nullptr : &it->second;
}

const std::string* StringField(const flutter::EncodableMap& map, const char* key) {
  const auto* value = Field(map, key);
  return value ? std::get_if<std::string>(value) : nullptr;
}

std::optional<double> NumberField(const flutter::EncodableMap& map, const char* key) {
  const auto* value = Field(map, key);
  if (!value) return std::nullopt;
  if (const auto* number = std::get_if<double>(value)) return *number;
  if (const auto* number = std::get_if<int32_t>(value)) return static_cast<double>(*number);
  if (const auto* number = std::get_if<int64_t>(value)) return static_cast<double>(*number);
  return std::nullopt;
}

std::wstring ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) return {};
  std::wstring wide(length, L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), wide.data(), length);
  return wide;
}

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (length <= 0) return {};
  std::string utf8(length, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), utf8.data(), length, nullptr, nullptr);
  return utf8;
}

std::vector<RECT> EnumerateDisplays() {
  std::vector<RECT> displays;
  EnumDisplayMonitors(nullptr, nullptr, [](HMONITOR monitor, HDC, LPRECT, LPARAM data) -> BOOL {
    MONITORINFO info{};
    info.cbSize = sizeof(MONITORINFO);
    if (GetMonitorInfoW(monitor, &info)) reinterpret_cast<std::vector<RECT>*>(data)->push_back(info.rcMonitor);
    return TRUE;
  }, reinterpret_cast<LPARAM>(&displays));
  return displays;
}

WORD VirtualKeyForCode(const std::string& code) {
  static const std::map<std::string, int> keys = {
      {"AltLeft", VK_LMENU},         {"AltRight", VK_RMENU},       {"ArrowDown", VK_DOWN},      {"ArrowLeft", VK_LEFT},
      {"ArrowRight", VK_RIGHT},      {"ArrowUp", VK_UP},           {"Backquote", VK_OEM_3},      {"Backslash", VK_OEM_5},
      {"Backspace", VK_BACK},        {"BracketLeft", VK_OEM_4},    {"BracketRight", VK_OEM_6},  {"CapsLock", VK_CAPITAL},
      {"Comma", VK_OEM_COMMA},       {"ContextMenu", VK_APPS},     {"ControlLeft", VK_LCONTROL}, {"ControlRight", VK_RCONTROL},
      {"Delete", VK_DELETE},         {"End", VK_END},              {"Enter", VK_RETURN},         {"Equal", VK_OEM_PLUS},
      {"Escape", VK_ESCAPE},         {"Home", VK_HOME},            {"Insert", VK_INSERT},        {"IntlBackslash", VK_OEM_102},
      {"MetaLeft", VK_LWIN},         {"MetaRight", VK_RWIN},       {"Minus", VK_OEM_MINUS},      {"NumLock", VK_NUMLOCK},
      {"NumpadAdd", VK_ADD},         {"NumpadDecimal", VK_DECIMAL}, {"NumpadDivide", VK_DIVIDE}, {"NumpadEnter", VK_RETURN},
      {"NumpadMultiply", VK_MULTIPLY}, {"NumpadSubtract", VK_SUBTRACT}, {"PageDown", VK_NEXT},     {"PageUp", VK_PRIOR},
      {"Pause", VK_PAUSE},           {"Period", VK_OEM_PERIOD},   {"PrintScreen", VK_SNAPSHOT}, {"Quote", VK_OEM_7},
      {"ScrollLock", VK_SCROLL},     {"Semicolon", VK_OEM_1},      {"ShiftLeft", VK_LSHIFT},     {"ShiftRight", VK_RSHIFT},
      {"Slash", VK_OEM_2},           {"Space", VK_SPACE},          {"Tab", VK_TAB},
  };
  if (code.size() == 4 && code.rfind("Key", 0) == 0 && code[3] >= 'A' && code[3] <= 'Z') return static_cast<WORD>(code[3]);
  if (code.size() == 6 && code.rfind("Digit", 0) == 0 && code[5] >= '0' && code[5] <= '9') return static_cast<WORD>(code[5]);
  if (code.size() == 7 && code.rfind("Numpad", 0) == 0 && code[6] >= '0' && code[6] <= '9') return static_cast<WORD>(VK_NUMPAD0 + code[6] - '0');
  if (code.size() >= 2 && code[0] == 'F') {
    const int key = std::atoi(code.c_str() + 1);
    if (key >= 1 && key <= 24) return static_cast<WORD>(VK_F1 + key - 1);
  }
  const auto found = keys.find(code);
  return found == keys.end() ? 0 : static_cast<WORD>(found->second);
}

WORD VirtualKeyForModifier(const std::string& modifier) {
  if (modifier == "shift") return VK_LSHIFT;
  if (modifier == "ctrl") return VK_LCONTROL;
  if (modifier == "alt") return VK_LMENU;
  if (modifier == "meta") return VK_LWIN;
  return 0;
}

std::optional<const char*> ModifierForCode(const std::string& code) {
  if (code == "ShiftLeft" || code == "ShiftRight") return "shift";
  if (code == "ControlLeft" || code == "ControlRight") return "ctrl";
  if (code == "AltLeft" || code == "AltRight") return "alt";
  if (code == "MetaLeft" || code == "MetaRight") return "meta";
  return std::nullopt;
}

bool IsExtendedKey(WORD key) {
  switch (key) {
    case VK_RMENU:
    case VK_RCONTROL:
    case VK_INSERT:
    case VK_DELETE:
    case VK_HOME:
    case VK_END:
    case VK_PRIOR:
    case VK_NEXT:
    case VK_LEFT:
    case VK_RIGHT:
    case VK_UP:
    case VK_DOWN:
    case VK_NUMLOCK:
    case VK_DIVIDE:
    case VK_LWIN:
    case VK_RWIN:
    case VK_APPS:
      return true;
    default:
      return false;
  }
}

INPUT KeyboardInput(WORD key, bool up) {
  INPUT input{};
  input.type = INPUT_KEYBOARD;
  const UINT scan_code = MapVirtualKeyW(key, MAPVK_VK_TO_VSC_EX);
  if (scan_code == 0) {
    input.ki.wVk = key;
    input.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
    return input;
  }
  input.ki.wScan = static_cast<WORD>(scan_code & 0xff);
  input.ki.dwFlags = KEYEVENTF_SCANCODE | (up ? KEYEVENTF_KEYUP : 0);
  if (IsExtendedKey(key) || (scan_code & 0xff00) != 0) input.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
  return input;
}

INPUT PointerInput(const RECT& display, double x, double y) {
  const int virtual_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
  const int virtual_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
  const int virtual_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
  const int virtual_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
  const double pixel_x = display.left + x * std::max(1L, display.right - display.left - 1);
  const double pixel_y = display.top + y * std::max(1L, display.bottom - display.top - 1);
  INPUT input{};
  input.type = INPUT_MOUSE;
  input.mi.dx = static_cast<LONG>(std::clamp((pixel_x - virtual_x) * 65535.0 / std::max(1, virtual_width - 1), 0.0, 65535.0));
  input.mi.dy = static_cast<LONG>(std::clamp((pixel_y - virtual_y) * 65535.0 / std::max(1, virtual_height - 1), 0.0, 65535.0));
  input.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
  return input;
}

bool Send(const std::vector<INPUT>& inputs) {
  if (inputs.empty()) return true;
  return SendInput(static_cast<UINT>(inputs.size()), const_cast<INPUT*>(inputs.data()), sizeof(INPUT)) == inputs.size();
}

std::wstring QuoteArgument(const std::wstring& value) {
  std::wstring result = L"\"";
  for (wchar_t ch : value) {
    if (ch == L'\"') result += L'\\';
    result += ch;
  }
  result += L"\"";
  return result;
}

}  // namespace

void RemoteControlBridge::RegisterWith(FlutterDesktopPluginRegistrarRef registrar) {
  registrar_ = std::make_unique<flutter::PluginRegistrarWindows>(registrar);
  channel_ = std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(
      registrar_->messenger(), "com.huddle.control-agent/windows", &flutter::StandardMethodCodec::GetInstance());
  channel_->SetMethodCallHandler([this](const auto& call, auto result) { HandleMethodCall(call, std::move(result)); });
}

void RemoteControlBridge::SetSessionState(const std::string& state) { session_state_ = state; }

void RemoteControlBridge::HandleMethodCall(const flutter::MethodCall<flutter::EncodableValue>& call, std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
  const auto& method = call.method_name();
  if (method == "configureDpiAwareness") {
    if (!SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) SetProcessDPIAware();
    result->Success();
  } else if (method == "isElevated") {
    result->Success(flutter::EncodableValue(IsElevated()));
  } else if (method == "nativeArchitecture") {
    result->Success(flutter::EncodableValue(NativeArchitecture()));
  } else if (method == "windowsVersion") {
    result->Success(flutter::EncodableValue(WindowsVersion()));
  } else if (method == "sessionState") {
    result->Success(flutter::EncodableValue(session_state_));
  } else if (method == "acknowledgeDisplayChange") {
    if (session_state_ == "display-changed") session_state_ = "active";
    result->Success();
  } else if (method == "setCaptureSource") {
    const auto* args = call.arguments() ? std::get_if<flutter::EncodableMap>(call.arguments()) : nullptr;
    const auto* source = args ? StringField(*args, "sourceId") : nullptr;
    std::string error;
    if (!source || !SetCaptureSource(*source, &error)) result->Error("display_unavailable", error);
    else result->Success();
  } else if (method == "applyInput") {
    const auto* args = call.arguments() ? std::get_if<flutter::EncodableMap>(call.arguments()) : nullptr;
    std::string error;
    if (!args || !ApplyInput(*args, &error)) result->Error("input_rejected", error);
    else result->Success();
  } else if (method == "releaseAll") {
    ReleaseAll() ? result->Success() : result->Error("input_blocked", "Windows rejected the release request.");
  } else if (method == "clipboardChangeCount") {
    result->Success(flutter::EncodableValue(ClipboardChangeCount()));
  } else if (method == "readClipboardText") {
    std::wstring clipboard;
    if (!ReadClipboard(&clipboard)) result->Success();
    else result->Success(flutter::EncodableValue(ToUtf8(clipboard)));
  } else if (method == "writeClipboardText") {
    const auto* args = call.arguments() ? std::get_if<flutter::EncodableMap>(call.arguments()) : nullptr;
    const auto* text = args ? StringField(*args, "text") : nullptr;
    const std::wstring wide = text ? ToWide(*text) : std::wstring();
    if (!text || text->empty() || text->size() > 6144 || wide.empty() || !WriteClipboard(wide)) result->Error("clipboard_unavailable", "Windows clipboard is unavailable.");
    else result->Success(flutter::EncodableValue(ClipboardChangeCount()));
  } else if (method == "sendClipboardShortcut") {
    const auto* args = call.arguments() ? std::get_if<flutter::EncodableMap>(call.arguments()) : nullptr;
    const auto* action = args ? StringField(*args, "action") : nullptr;
    if (!action || (*action != "copy" && *action != "paste")) result->Error("invalid_shortcut", "Invalid clipboard shortcut.");
    else {
      const WORD key = *action == "copy" ? 'C' : 'V';
      Send({KeyboardInput(VK_CONTROL, false), KeyboardInput(key, false), KeyboardInput(key, true), KeyboardInput(VK_CONTROL, true)}) ? result->Success() : result->Error("input_blocked", "Windows rejected the clipboard shortcut.");
    }
  } else if (method == "restartElevated") {
    const auto* args = call.arguments() ? std::get_if<flutter::EncodableMap>(call.arguments()) : nullptr;
    const auto* link = args ? StringField(*args, "link") : nullptr;
    std::string error;
    if (!link || !RelaunchElevated(ToWide(*link), &error)) result->Error("elevation_cancelled", error);
    else result->Success();
  } else {
    result->NotImplemented();
  }
}

bool RemoteControlBridge::SetCaptureSource(const std::string& source_id, std::string* error) {
  if (source_id.rfind("screen:", 0) != 0) {
    *error = "Remote Control can only capture an entire display.";
    return false;
  }
  const auto second_colon = source_id.find(':', 7);
  const auto index_text = source_id.substr(7, second_colon == std::string::npos ? std::string::npos : second_colon - 7);
  char* end = nullptr;
  const long index = std::strtol(index_text.c_str(), &end, 10);
  const auto displays = EnumerateDisplays();
  if (end == index_text.c_str() || index < 0 || static_cast<size_t>(index) >= displays.size()) {
    *error = "Windows could not map the selected display. Select it again.";
    return false;
  }
  selected_display_ = displays[static_cast<size_t>(index)];
  return true;
}

bool RemoteControlBridge::ApplyInput(const flutter::EncodableMap& event, std::string* error) {
  const auto* kind = StringField(event, "kind");
  if (session_state_ != "active") {
    *error = "The Windows desktop session or display configuration changed.";
    return false;
  }
  if (!kind || selected_display_.right <= selected_display_.left || selected_display_.bottom <= selected_display_.top) {
    *error = "No selected display is available.";
    return false;
  }
  std::vector<INPUT> inputs;
  if (*kind == "release-all") return ReleaseAll();
  if (*kind == "key") {
    const auto* action = StringField(event, "action");
    const auto* code = StringField(event, "code");
    const auto* modifiers_value = Field(event, "modifiers");
    if (!action || !code || (*action != "down" && *action != "up")) {
      *error = "Malformed keyboard event.";
      return false;
    }
    const WORD key = VirtualKeyForCode(*code);
    if (!key) {
      *error = "Unsupported keyboard code.";
      return false;
    }
    const auto modifier_for_code = ModifierForCode(*code);
    if (*action == "down" && modifiers_value) {
      if (const auto* modifiers = std::get_if<flutter::EncodableList>(modifiers_value)) {
        for (const auto& value : *modifiers) {
          const auto* modifier = std::get_if<std::string>(&value);
          const WORD modifier_key = modifier && modifier_for_code && *modifier == *modifier_for_code
              ? key
              : (modifier ? VirtualKeyForModifier(*modifier) : 0);
          if (modifier_key && std::find(pressed_keys_.begin(), pressed_keys_.end(), modifier_key) == pressed_keys_.end()) {
            inputs.push_back(KeyboardInput(modifier_key, false));
            pressed_keys_.push_back(modifier_key);
          }
        }
      }
    }
    const bool up = *action == "up";
    if (up) pressed_keys_.erase(std::remove(pressed_keys_.begin(), pressed_keys_.end(), key), pressed_keys_.end());
    else if (std::find(pressed_keys_.begin(), pressed_keys_.end(), key) == pressed_keys_.end()) pressed_keys_.push_back(key);
    inputs.push_back(KeyboardInput(key, up));
  } else {
    const auto x = NumberField(event, "x");
    const auto y = NumberField(event, "y");
    if (!x || !y || *x < 0 || *x > 1 || *y < 0 || *y > 1) {
      *error = "Malformed pointer event.";
      return false;
    }
    inputs.push_back(PointerInput(selected_display_, *x, *y));
    if (*kind == "down" || *kind == "up") {
      const auto* button = StringField(event, "button");
      if (!button) {
        *error = "Malformed pointer button.";
        return false;
      }
      DWORD flag = 0;
      if (*button == "left") flag = *kind == "down" ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
      if (*button == "middle") flag = *kind == "down" ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
      if (*button == "right") flag = *kind == "down" ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
      if (!flag) {
        *error = "Unsupported pointer button.";
        return false;
      }
      INPUT button_input{};
      button_input.type = INPUT_MOUSE;
      button_input.mi.dwFlags = flag;
      inputs.push_back(button_input);
    } else if (*kind == "scroll") {
      const auto dx = NumberField(event, "dx");
      const auto dy = NumberField(event, "dy");
      if (!dx || !dy || std::abs(*dx) > 2000 || std::abs(*dy) > 2000) {
        *error = "Malformed wheel event.";
        return false;
      }
      const double vertical_value = vertical_remainder_ - (*dy * WHEEL_DELTA / 100.0);
      const double horizontal_value = horizontal_remainder_ - (*dx * WHEEL_DELTA / 100.0);
      const int vertical = static_cast<int>(std::trunc(vertical_value));
      const int horizontal = static_cast<int>(std::trunc(horizontal_value));
      vertical_remainder_ = vertical_value - vertical;
      horizontal_remainder_ = horizontal_value - horizontal;
      if (vertical) {
        INPUT wheel{};
        wheel.type = INPUT_MOUSE;
        wheel.mi.dwFlags = MOUSEEVENTF_WHEEL;
        wheel.mi.mouseData = vertical;
        inputs.push_back(wheel);
      }
      if (horizontal) {
        INPUT wheel{};
        wheel.type = INPUT_MOUSE;
        wheel.mi.dwFlags = MOUSEEVENTF_HWHEEL;
        wheel.mi.mouseData = horizontal;
        inputs.push_back(wheel);
      }
    } else if (*kind != "move") {
      *error = "Unsupported input event.";
      return false;
    }
  }
  if (!Send(inputs)) {
    *error = "Windows blocked the input request. Administrator applications require the elevated attended mode.";
    return false;
  }
  return true;
}

bool RemoteControlBridge::ReleaseAll() {
  std::vector<INPUT> inputs;
  for (const WORD key : pressed_keys_) inputs.push_back(KeyboardInput(key, true));
  pressed_keys_.clear();
  for (const DWORD flag : {MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTUP}) {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = flag;
    inputs.push_back(input);
  }
  vertical_remainder_ = 0;
  horizontal_remainder_ = 0;
  return Send(inputs);
}

bool RemoteControlBridge::IsElevated() const {
  HANDLE token = nullptr;
  TOKEN_ELEVATION elevation{};
  DWORD size = 0;
  const bool elevated = OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token) && GetTokenInformation(token, TokenElevation, &elevation, sizeof(elevation), &size) && elevation.TokenIsElevated;
  if (token) CloseHandle(token);
  return elevated;
}

std::string RemoteControlBridge::NativeArchitecture() const {
  SYSTEM_INFO info{};
  GetNativeSystemInfo(&info);
  switch (info.wProcessorArchitecture) {
    case PROCESSOR_ARCHITECTURE_AMD64:
      return "x64";
    case PROCESSOR_ARCHITECTURE_ARM64:
      return "arm64";
    case PROCESSOR_ARCHITECTURE_INTEL:
      return "x86";
    case PROCESSOR_ARCHITECTURE_ARM:
      return "arm32";
    default:
      return "unknown";
  }
}

std::string RemoteControlBridge::WindowsVersion() const {
  using RtlGetVersion = LONG(WINAPI*)(OSVERSIONINFOW*);
  const auto ntdll = GetModuleHandleW(L"ntdll.dll");
  const auto rtl_get_version = ntdll ? reinterpret_cast<RtlGetVersion>(GetProcAddress(ntdll, "RtlGetVersion")) : nullptr;
  OSVERSIONINFOW version{};
  version.dwOSVersionInfoSize = sizeof(version);
  if (!rtl_get_version || rtl_get_version(&version) != 0) return "0.0.0";
  return std::to_string(version.dwMajorVersion) + "." + std::to_string(version.dwMinorVersion) + "." + std::to_string(version.dwBuildNumber);
}

int RemoteControlBridge::ClipboardChangeCount() const { return static_cast<int>(GetClipboardSequenceNumber()); }

bool RemoteControlBridge::ReadClipboard(std::wstring* value) const {
  for (int attempt = 0; attempt < 5; ++attempt) {
    if (OpenClipboard(nullptr)) {
      HANDLE handle = GetClipboardData(CF_UNICODETEXT);
      if (handle) {
        const auto* text = static_cast<const wchar_t*>(GlobalLock(handle));
        if (text) {
          constexpr size_t maximum_wide_characters = 6 * 1024 + 1;
          const size_t capacity = GlobalSize(handle) / sizeof(wchar_t);
          const size_t scanned = std::min(capacity, maximum_wide_characters);
          const size_t length = wcsnlen_s(text, scanned);
          if (length < scanned || (length == scanned && scanned < maximum_wide_characters)) {
            std::wstring candidate(text, length);
            const std::string utf8 = ToUtf8(candidate);
            if (utf8.size() <= 6 * 1024) *value = std::move(candidate);
          }
          GlobalUnlock(handle);
          CloseClipboard();
          return !value->empty();
        }
      }
      CloseClipboard();
    }
    Sleep(10);
  }
  return false;
}

bool RemoteControlBridge::WriteClipboard(const std::wstring& value) const {
  for (int attempt = 0; attempt < 5; ++attempt) {
    if (OpenClipboard(nullptr)) {
      if (!EmptyClipboard()) {
        CloseClipboard();
        Sleep(10);
        continue;
      }
      const size_t bytes = (value.size() + 1) * sizeof(wchar_t);
      HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, bytes);
      if (!memory) {
        CloseClipboard();
        return false;
      }
      auto* target = static_cast<wchar_t*>(GlobalLock(memory));
      if (!target) {
        GlobalFree(memory);
        CloseClipboard();
        Sleep(10);
        continue;
      }
      memcpy(target, value.c_str(), bytes);
      GlobalUnlock(memory);
      if (!SetClipboardData(CF_UNICODETEXT, memory)) {
        GlobalFree(memory);
        CloseClipboard();
        return false;
      }
      CloseClipboard();
      return true;
    }
    Sleep(10);
  }
  return false;
}

bool RemoteControlBridge::RelaunchElevated(const std::wstring& link, std::string* error) const {
  wchar_t executable[MAX_PATH]{};
  if (!GetModuleFileNameW(nullptr, executable, MAX_PATH)) {
    *error = "Windows could not locate the Control Agent executable.";
    return false;
  }
  const std::wstring arguments = L"--elevated-session --link " + QuoteArgument(link);
  const auto result = reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"runas", executable, arguments.c_str(), nullptr, SW_SHOWNORMAL));
  if (result <= 32) {
    *error = "Windows elevation was cancelled or unavailable. No Remote Control session was started.";
    return false;
  }
  return true;
}
