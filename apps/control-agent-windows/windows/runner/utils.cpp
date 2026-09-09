#include "utils.h"

#include <flutter_windows.h>
#include <io.h>
#include <stdio.h>
#include <windows.h>

void CreateAndAttachConsole() {
  if (::AllocConsole()) {
    FILE* unused = nullptr;
    freopen_s(&unused, "CONOUT$", "w", stdout);
    freopen_s(&unused, "CONOUT$", "w", stderr);
    _dup2(_fileno(stdout), 1);
    _dup2(_fileno(stderr), 2);
  }
}
