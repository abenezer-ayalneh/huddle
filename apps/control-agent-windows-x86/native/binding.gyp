{
  "targets": [
    {
      "target_name": "huddle_control_bridge",
      "sources": ["src/control_bridge_napi.cc"],
      "defines": ["NAPI_VERSION=8"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "libraries": ["user32.lib", "shell32.lib"]
    }
  ]
}
