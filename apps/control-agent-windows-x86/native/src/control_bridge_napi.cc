#include <node_api.h>
#include <shellapi.h>
#include <windows.h>

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <cwchar>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace {

class ControlBridge {
 public:
  bool ConfigureDpiAwareness() const {
    return SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) || SetProcessDPIAware();
  }

  bool SetCaptureSource(const std::string& source_id, std::string* error) {
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

  bool ApplyInput(const std::string& kind, const std::optional<std::string>& action, const std::optional<std::string>& code,
                  const std::vector<std::string>& modifiers, const std::optional<double>& x, const std::optional<double>& y,
                  const std::optional<std::string>& button, const std::optional<double>& dx, const std::optional<double>& dy,
                  std::string* error) {
    if (session_state_ != "active") {
      *error = "The Windows desktop session or display configuration changed.";
      return false;
    }
    if (kind == "release-all") return ReleaseAll();
    if (selected_display_.right <= selected_display_.left || selected_display_.bottom <= selected_display_.top) {
      *error = "No selected display is available.";
      return false;
    }
    std::vector<INPUT> inputs;
    if (kind == "key") {
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
      if (*action == "down") {
        for (const auto& modifier : modifiers) {
          const WORD modifier_key = modifier_for_code && modifier == *modifier_for_code ? key : VirtualKeyForModifier(modifier);
          if (modifier_key && std::find(pressed_keys_.begin(), pressed_keys_.end(), modifier_key) == pressed_keys_.end()) {
            inputs.push_back(KeyboardInput(modifier_key, false));
            pressed_keys_.push_back(modifier_key);
          }
        }
      }
      const bool up = *action == "up";
      if (up) {
        pressed_keys_.erase(std::remove(pressed_keys_.begin(), pressed_keys_.end(), key), pressed_keys_.end());
      } else if (std::find(pressed_keys_.begin(), pressed_keys_.end(), key) == pressed_keys_.end()) {
        pressed_keys_.push_back(key);
      }
      inputs.push_back(KeyboardInput(key, up));
    } else {
      if (!x || !y || *x < 0 || *x > 1 || *y < 0 || *y > 1) {
        *error = "Malformed pointer event.";
        return false;
      }
      inputs.push_back(PointerInput(selected_display_, *x, *y));
      if (kind == "down" || kind == "up") {
        if (!button) {
          *error = "Malformed pointer button.";
          return false;
        }
        DWORD flag = 0;
        if (*button == "left") flag = kind == "down" ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
        if (*button == "middle") flag = kind == "down" ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
        if (*button == "right") flag = kind == "down" ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
        if (!flag) {
          *error = "Unsupported pointer button.";
          return false;
        }
        INPUT button_input{};
        button_input.type = INPUT_MOUSE;
        button_input.mi.dwFlags = flag;
        inputs.push_back(button_input);
      } else if (kind == "scroll") {
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
      } else if (kind != "move") {
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

  bool ReleaseAll() {
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

  bool IsElevated() const {
    HANDLE token = nullptr;
    TOKEN_ELEVATION elevation{};
    DWORD size = 0;
    const bool elevated = OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token) &&
        GetTokenInformation(token, TokenElevation, &elevation, sizeof(elevation), &size) && elevation.TokenIsElevated;
    if (token) CloseHandle(token);
    return elevated;
  }

  std::string NativeArchitecture() const {
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

  std::string WindowsVersion() const {
    using RtlGetVersion = LONG(WINAPI*)(OSVERSIONINFOW*);
    const auto ntdll = GetModuleHandleW(L"ntdll.dll");
    const auto rtl_get_version = ntdll ? reinterpret_cast<RtlGetVersion>(GetProcAddress(ntdll, "RtlGetVersion")) : nullptr;
    OSVERSIONINFOW version{};
    version.dwOSVersionInfoSize = sizeof(version);
    if (!rtl_get_version || rtl_get_version(&version) != 0) return "0.0.0";
    return std::to_string(version.dwMajorVersion) + "." + std::to_string(version.dwMinorVersion) + "." + std::to_string(version.dwBuildNumber);
  }

  int ClipboardChangeCount() const { return static_cast<int>(GetClipboardSequenceNumber()); }

  bool ReadClipboard(std::wstring* value) const {
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
              if (ToUtf8(candidate).size() <= 6 * 1024) *value = std::move(candidate);
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

  bool WriteClipboard(const std::wstring& value) const {
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

  bool SendClipboardShortcut(const std::string& action) {
    if (action != "copy" && action != "paste") return false;
    const WORD key = action == "copy" ? 'C' : 'V';
    return Send({KeyboardInput(VK_CONTROL, false), KeyboardInput(key, false), KeyboardInput(key, true), KeyboardInput(VK_CONTROL, true)});
  }

  bool RelaunchElevated(const std::wstring& link, std::string* error) const {
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

  const std::string& SessionState() const { return session_state_; }
  void SetSessionState(std::string value) { session_state_ = std::move(value); }
  void AcknowledgeDisplayChange() {
    if (session_state_ == "display-changed") session_state_ = "active";
  }

 private:
  static std::vector<RECT> EnumerateDisplays() {
    std::vector<RECT> displays;
    EnumDisplayMonitors(nullptr, nullptr, [](HMONITOR monitor, HDC, LPRECT, LPARAM data) -> BOOL {
      MONITORINFO info{};
      info.cbSize = sizeof(MONITORINFO);
      if (GetMonitorInfoW(monitor, &info)) reinterpret_cast<std::vector<RECT>*>(data)->push_back(info.rcMonitor);
      return TRUE;
    }, reinterpret_cast<LPARAM>(&displays));
    return displays;
  }

  static std::wstring ToWide(const std::string& value) {
    if (value.empty()) return {};
    const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
    if (length <= 0) return {};
    std::wstring wide(length, L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), wide.data(), length);
    return wide;
  }

  static std::string ToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (length <= 0) return {};
    std::string utf8(length, '\0');
    WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), utf8.data(), length, nullptr, nullptr);
    return utf8;
  }

  static std::wstring QuoteArgument(const std::wstring& value) {
    std::wstring result = L"\"";
    for (const auto ch : value) {
      if (ch == L'\"') result += L'\\';
      result += ch;
    }
    result += L"\"";
    return result;
  }

  static WORD VirtualKeyForCode(const std::string& code) {
    static const std::map<std::string, WORD> keys = {
        {"AltLeft", VK_LMENU}, {"AltRight", VK_RMENU}, {"ArrowDown", VK_DOWN}, {"ArrowLeft", VK_LEFT}, {"ArrowRight", VK_RIGHT},
        {"ArrowUp", VK_UP}, {"Backquote", VK_OEM_3}, {"Backslash", VK_OEM_5}, {"Backspace", VK_BACK}, {"BracketLeft", VK_OEM_4},
        {"BracketRight", VK_OEM_6}, {"CapsLock", VK_CAPITAL}, {"Comma", VK_OEM_COMMA}, {"ContextMenu", VK_APPS}, {"ControlLeft", VK_LCONTROL},
        {"ControlRight", VK_RCONTROL}, {"Delete", VK_DELETE}, {"End", VK_END}, {"Enter", VK_RETURN}, {"Equal", VK_OEM_PLUS},
        {"Escape", VK_ESCAPE}, {"Home", VK_HOME}, {"Insert", VK_INSERT}, {"IntlBackslash", VK_OEM_102}, {"MetaLeft", VK_LWIN},
        {"MetaRight", VK_RWIN}, {"Minus", VK_OEM_MINUS}, {"NumLock", VK_NUMLOCK}, {"NumpadAdd", VK_ADD}, {"NumpadDecimal", VK_DECIMAL},
        {"NumpadDivide", VK_DIVIDE}, {"NumpadEnter", VK_RETURN}, {"NumpadMultiply", VK_MULTIPLY}, {"NumpadSubtract", VK_SUBTRACT},
        {"PageDown", VK_NEXT}, {"PageUp", VK_PRIOR}, {"Pause", VK_PAUSE}, {"Period", VK_OEM_PERIOD}, {"PrintScreen", VK_SNAPSHOT},
        {"Quote", VK_OEM_7}, {"ScrollLock", VK_SCROLL}, {"Semicolon", VK_OEM_1}, {"ShiftLeft", VK_LSHIFT}, {"ShiftRight", VK_RSHIFT},
        {"Slash", VK_OEM_2}, {"Space", VK_SPACE}, {"Tab", VK_TAB},
    };
    if (code.size() == 4 && code.rfind("Key", 0) == 0 && code[3] >= 'A' && code[3] <= 'Z') return static_cast<WORD>(code[3]);
    if (code.size() == 6 && code.rfind("Digit", 0) == 0 && code[5] >= '0' && code[5] <= '9') return static_cast<WORD>(code[5]);
    if (code.size() == 7 && code.rfind("Numpad", 0) == 0 && code[6] >= '0' && code[6] <= '9') return static_cast<WORD>(VK_NUMPAD0 + code[6] - '0');
    if (code.size() >= 2 && code[0] == 'F') {
      const int key = std::atoi(code.c_str() + 1);
      if (key >= 1 && key <= 24) return static_cast<WORD>(VK_F1 + key - 1);
    }
    const auto found = keys.find(code);
    return found == keys.end() ? 0 : found->second;
  }

  static WORD VirtualKeyForModifier(const std::string& modifier) {
    if (modifier == "shift") return VK_LSHIFT;
    if (modifier == "ctrl") return VK_LCONTROL;
    if (modifier == "alt") return VK_LMENU;
    if (modifier == "meta") return VK_LWIN;
    return 0;
  }

  static std::optional<const char*> ModifierForCode(const std::string& code) {
    if (code == "ShiftLeft" || code == "ShiftRight") return "shift";
    if (code == "ControlLeft" || code == "ControlRight") return "ctrl";
    if (code == "AltLeft" || code == "AltRight") return "alt";
    if (code == "MetaLeft" || code == "MetaRight") return "meta";
    return std::nullopt;
  }

  static bool IsExtendedKey(WORD key) {
    switch (key) {
      case VK_RMENU: case VK_RCONTROL: case VK_INSERT: case VK_DELETE: case VK_HOME: case VK_END: case VK_PRIOR: case VK_NEXT:
      case VK_LEFT: case VK_RIGHT: case VK_UP: case VK_DOWN: case VK_NUMLOCK: case VK_DIVIDE: case VK_LWIN: case VK_RWIN: case VK_APPS:
        return true;
      default:
        return false;
    }
  }

  static INPUT KeyboardInput(WORD key, bool up) {
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    const UINT scan_code = MapVirtualKeyW(key, MAPVK_VK_TO_VSC_EX);
    if (scan_code == 0) {
      input.ki.wVk = key;
      input.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
      return input;
    }
    input.ki.wScan = static_cast<WORD>(scan_code & 0xff);
    input.ki.dwFlags = KEYEVENTF_SCANCODE | (IsExtendedKey(key) ? KEYEVENTF_EXTENDEDKEY : 0) | (up ? KEYEVENTF_KEYUP : 0);
    return input;
  }

  static INPUT PointerInput(const RECT& display, double x, double y) {
    const int virtual_left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    const int virtual_top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    const int virtual_width = std::max(1, GetSystemMetrics(SM_CXVIRTUALSCREEN));
    const int virtual_height = std::max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
    const int width = std::max(1L, display.right - display.left);
    const int height = std::max(1L, display.bottom - display.top);
    const double absolute_x = display.left + x * (width - 1);
    const double absolute_y = display.top + y * (height - 1);
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dx = static_cast<LONG>(std::lround((absolute_x - virtual_left) * 65535.0 / std::max(1, virtual_width - 1)));
    input.mi.dy = static_cast<LONG>(std::lround((absolute_y - virtual_top) * 65535.0 / std::max(1, virtual_height - 1)));
    input.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    return input;
  }

  static bool Send(const std::vector<INPUT>& inputs) {
    return inputs.empty() || SendInput(static_cast<UINT>(inputs.size()), const_cast<INPUT*>(inputs.data()), sizeof(INPUT)) == inputs.size();
  }

  RECT selected_display_{0, 0, 0, 0};
  std::string session_state_ = "active";
  double vertical_remainder_ = 0;
  double horizontal_remainder_ = 0;
  std::vector<WORD> pressed_keys_;
};

ControlBridge bridge;

napi_value Undefined(napi_env env) {
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}

napi_value Boolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

napi_value Number(napi_env env, int value) {
  napi_value result;
  napi_create_int32(env, value, &result);
  return result;
}

napi_value String(napi_env env, const std::string& value) {
  napi_value result;
  napi_create_string_utf8(env, value.c_str(), value.size(), &result);
  return result;
}

napi_value Error(napi_env env, const std::string& message) {
  napi_throw_error(env, nullptr, message.c_str());
  return nullptr;
}

bool StringValue(napi_env env, napi_value value, std::string* result) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_string) return false;
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) return false;
  std::vector<char> buffer(length + 1);
  if (napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length) != napi_ok) return false;
  *result = std::string(buffer.data(), length);
  return true;
}

bool NumberValue(napi_env env, napi_value value, double* result) {
  napi_valuetype type;
  return napi_typeof(env, value, &type) == napi_ok && type == napi_number && napi_get_value_double(env, value, result) == napi_ok && std::isfinite(*result);
}

bool Property(napi_env env, napi_value object, const char* key, napi_value* value) {
  bool has = false;
  return napi_has_named_property(env, object, key, &has) == napi_ok && has && napi_get_named_property(env, object, key, value) == napi_ok;
}

std::optional<std::string> OptionalStringProperty(napi_env env, napi_value object, const char* key) {
  napi_value value;
  std::string result;
  return Property(env, object, key, &value) && StringValue(env, value, &result) ? std::optional<std::string>(result) : std::nullopt;
}

std::optional<double> OptionalNumberProperty(napi_env env, napi_value object, const char* key) {
  napi_value value;
  double result = 0;
  return Property(env, object, key, &value) && NumberValue(env, value, &result) ? std::optional<double>(result) : std::nullopt;
}

bool StringArrayProperty(napi_env env, napi_value object, const char* key, std::vector<std::string>* result) {
  napi_value value;
  bool is_array = false;
  if (!Property(env, object, key, &value) || napi_is_array(env, value, &is_array) != napi_ok || !is_array) return false;
  uint32_t length = 0;
  if (napi_get_array_length(env, value, &length) != napi_ok || length > 4) return false;
  for (uint32_t index = 0; index < length; ++index) {
    napi_value item;
    std::string modifier;
    if (napi_get_element(env, value, index, &item) != napi_ok || !StringValue(env, item, &modifier)) return false;
    result->push_back(std::move(modifier));
  }
  return true;
}

napi_value NoArguments(napi_env env, napi_callback_info info, size_t expected, napi_value* arguments) {
  size_t count = expected;
  napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
  return count == expected ? Undefined(env) : Error(env, "Invalid Control Agent native call.");
}

napi_value ConfigureDpi(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  bridge.ConfigureDpiAwareness();
  return Undefined(env);
}

napi_value IsElevated(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return Boolean(env, bridge.IsElevated());
}

napi_value NativeArchitecture(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return String(env, bridge.NativeArchitecture());
}

napi_value WindowsVersion(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return String(env, bridge.WindowsVersion());
}

napi_value SetCaptureSource(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  std::string source;
  if (!StringValue(env, arguments[0], &source)) return Error(env, "Invalid display source.");
  std::string error;
  return bridge.SetCaptureSource(source, &error) ? Undefined(env) : Error(env, error);
}

napi_value ApplyInput(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  napi_valuetype type;
  if (napi_typeof(env, arguments[0], &type) != napi_ok || type != napi_object) return Error(env, "Malformed input event.");
  const auto kind = OptionalStringProperty(env, arguments[0], "kind");
  std::vector<std::string> modifiers;
  if (!kind || !StringArrayProperty(env, arguments[0], "modifiers", &modifiers) && *kind == "key") return Error(env, "Malformed input event.");
  std::string error;
  const bool accepted = bridge.ApplyInput(*kind, OptionalStringProperty(env, arguments[0], "action"), OptionalStringProperty(env, arguments[0], "code"), modifiers,
                                          OptionalNumberProperty(env, arguments[0], "x"), OptionalNumberProperty(env, arguments[0], "y"),
                                          OptionalStringProperty(env, arguments[0], "button"), OptionalNumberProperty(env, arguments[0], "dx"),
                                          OptionalNumberProperty(env, arguments[0], "dy"), &error);
  return accepted ? Undefined(env) : Error(env, error);
}

napi_value ReleaseAll(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return bridge.ReleaseAll() ? Undefined(env) : Error(env, "Windows rejected the release request.");
}

napi_value ClipboardChangeCount(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return Number(env, bridge.ClipboardChangeCount());
}

napi_value ReadClipboardText(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  std::wstring value;
  if (!bridge.ReadClipboard(&value)) return Undefined(env);
  const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (length <= 0) return Undefined(env);
  std::string utf8(length, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), utf8.data(), length, nullptr, nullptr);
  return String(env, utf8);
}

napi_value WriteClipboardText(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  std::string text;
  if (!StringValue(env, arguments[0], &text) || text.empty() || text.size() > 6 * 1024) return Error(env, "Windows clipboard is unavailable.");
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), nullptr, 0);
  if (length <= 0) return Error(env, "Windows clipboard is unavailable.");
  std::wstring wide(length, L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), wide.data(), length);
  return bridge.WriteClipboard(wide) ? Number(env, bridge.ClipboardChangeCount()) : Error(env, "Windows clipboard is unavailable.");
}

napi_value SendClipboardShortcut(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  std::string action;
  if (!StringValue(env, arguments[0], &action) || !bridge.SendClipboardShortcut(action)) return Error(env, "Windows rejected the clipboard shortcut.");
  return Undefined(env);
}

napi_value RelaunchElevated(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  std::string link;
  if (!StringValue(env, arguments[0], &link)) return Error(env, "Invalid Control Agent link.");
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, link.data(), static_cast<int>(link.size()), nullptr, 0);
  if (length <= 0) return Error(env, "Invalid Control Agent link.");
  std::wstring wide(length, L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, link.data(), static_cast<int>(link.size()), wide.data(), length);
  std::string error;
  return bridge.RelaunchElevated(wide, &error) ? Undefined(env) : Error(env, error);
}

napi_value SessionState(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  return String(env, bridge.SessionState());
}

napi_value SetSessionState(napi_env env, napi_callback_info info) {
  napi_value arguments[1];
  if (!NoArguments(env, info, 1, arguments)) return nullptr;
  std::string state;
  if (!StringValue(env, arguments[0], &state) || (state != "active" && state != "inactive" && state != "display-changed")) return Error(env, "Invalid Windows session state.");
  bridge.SetSessionState(state);
  return Undefined(env);
}

napi_value AcknowledgeDisplayChange(napi_env env, napi_callback_info info) {
  if (!NoArguments(env, info, 0, nullptr)) return nullptr;
  bridge.AcknowledgeDisplayChange();
  return Undefined(env);
}

void Define(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value value;
  napi_create_function(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &value);
  napi_set_named_property(env, exports, name, value);
}

}  // namespace

NAPI_MODULE_INIT() {
  Define(env, exports, "configureDpiAwareness", ConfigureDpi);
  Define(env, exports, "isElevated", IsElevated);
  Define(env, exports, "nativeArchitecture", NativeArchitecture);
  Define(env, exports, "windowsVersion", WindowsVersion);
  Define(env, exports, "setCaptureSource", SetCaptureSource);
  Define(env, exports, "applyInput", ApplyInput);
  Define(env, exports, "releaseAll", ReleaseAll);
  Define(env, exports, "clipboardChangeCount", ClipboardChangeCount);
  Define(env, exports, "readClipboardText", ReadClipboardText);
  Define(env, exports, "writeClipboardText", WriteClipboardText);
  Define(env, exports, "sendClipboardShortcut", SendClipboardShortcut);
  Define(env, exports, "relaunchElevated", RelaunchElevated);
  Define(env, exports, "sessionState", SessionState);
  Define(env, exports, "setSessionState", SetSessionState);
  Define(env, exports, "acknowledgeDisplayChange", AcknowledgeDisplayChange);
  return exports;
}
