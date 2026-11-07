cmake_minimum_required(VERSION 3.21)
project(VECTOR LANGUAGES CXX)

if(NOT WIN32)
    message(FATAL_ERROR "VECTOR targets Windows. Use MSVC on Windows or a Windows cross-toolchain.")
endif()
if(CMAKE_SIZEOF_VOID_P AND NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "VECTOR requires a 64-bit target.")
endif()
if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build configuration" FORCE)
endif()

# Explicit source list. No downloaded code, prebuilt archive, Lua, auth or build hook.
set(VECTOR_SOURCES
    source/source.cpp
    source/framework/features/cache/cache.cpp
    source/framework/features/cache/wallcheck/wallcheck.cpp
    source/framework/features/entry/entry.cpp
    source/framework/features/functions/aimbot/aimbot.cpp
    source/framework/features/functions/exploits/exploits.cpp
    source/framework/features/functions/silent_aim/silent_aim.cpp
    source/framework/features/functions/triggerbot/triggerbot.cpp
    source/framework/features/functions/visuals/visuals.cpp
    source/framework/overlay/config/config.cpp
    source/framework/overlay/menu.cpp
    source/framework/overlay/misc/widgets.cpp
    source/utils/clipper/clipper.engine.cpp
    source/utils/clipper/clipper.offset.cpp
    source/utils/clipper/clipper.rectclip.cpp
    source/utils/imgui/imgui.cpp
    source/utils/imgui/imgui_draw.cpp
    source/utils/imgui/imgui_tables.cpp
    source/utils/imgui/imgui_widgets.cpp
    source/utils/imgui/backends/imgui_impl_win32.cpp
    source/utils/imgui/backends/imgui_impl_dx11.cpp
)

add_executable(VECTOR ${VECTOR_SOURCES})
target_compile_features(VECTOR PRIVATE cxx_std_20)
set_target_properties(VECTOR PROPERTIES
    CXX_EXTENSIONS OFF
    OUTPUT_NAME VECTOR
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/dist/$<CONFIG>"
    MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>"
)
target_include_directories(VECTOR PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/source/utils/clipper"
)
target_compile_definitions(VECTOR PRIVATE
    NOMINMAX WIN32_LEAN_AND_MEAN _WIN32_WINNT=0x0A00
    _CRT_SECURE_NO_WARNINGS _USE_MATH_DEFINES IMGUI_IMPL_WIN32_DISABLE_GAMEPAD
)
target_link_libraries(VECTOR PRIVATE
    d3d11 d3dcompiler dxgi dwmapi user32 gdi32 shell32
    ole32 windowscodecs advapi32
)
if(MSVC)
    target_compile_options(VECTOR PRIVATE /W3 /permissive- /EHsc /utf-8 /Zc:__cplusplus)
elseif(MINGW)
    target_compile_options(VECTOR PRIVATE -Wall -Wextra -Wno-unknown-pragmas)
    target_link_options(VECTOR PRIVATE -static)
endif()
source_group(TREE "${CMAKE_CURRENT_SOURCE_DIR}" FILES ${VECTOR_SOURCES})
