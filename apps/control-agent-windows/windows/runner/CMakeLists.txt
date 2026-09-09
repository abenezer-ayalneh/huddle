add_executable(${BINARY_NAME} WIN32
  "flutter_window.cpp"
  "main.cpp"
  "remote_control_bridge.cpp"
  "runner.exe.manifest"
  "utils.cpp"
)

apply_standard_settings(${BINARY_NAME})
target_compile_features(${BINARY_NAME} PUBLIC cxx_std_17)
target_compile_definitions(${BINARY_NAME} PRIVATE "FLUTTER_VERSION=\"0.1.0\"")
target_include_directories(${BINARY_NAME} PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(${BINARY_NAME} PRIVATE flutter flutter_wrapper_app wtsapi32 shell32 user32)
add_dependencies(${BINARY_NAME} flutter_assemble)
