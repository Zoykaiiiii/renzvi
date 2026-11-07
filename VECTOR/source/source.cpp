#include <windows.h>
#include <chrono>
#include <exception>
#include <iostream>
#include <thread>

#include <source/utils/console/console.hpp>
#include <source/utils/memory/memory.hpp>
#include <source/framework/features/entry/entry.hpp>
#include <source/framework/overlay/menu.hpp>

int main()
{
    console->initialize();
    console->set_title("VECTOR");
    console->print(c_console::log_level::welcome, "VECTOR - local startup");
    console->print(c_console::log_level::info, "waiting for RobloxPlayerBeta.exe");

    // Check compatibility before the existing entry starts any worker threads.
    while (!g_memory->get_process_id("RobloxPlayerBeta.exe"))
        std::this_thread::sleep_for(std::chrono::milliseconds(500));

    if (!g_memory->get_process_handle("RobloxPlayerBeta.exe"))
    {
        console->print(c_console::log_level::error, "opening the process failed (Windows error %lu)", GetLastError());
        return 1;
    }

    if (!g_memory->get_process_base("RobloxPlayerBeta.exe"))
    {
        console->print(c_console::log_level::error,
            "client version or module check failed; expected %s (Windows error %lu)",
            c_memory::supported_client_version, GetLastError());
        return 1;
    }

    try
    {
        features::entry->initialize();
        console->print(c_console::log_level::info,
            "initialized; defaults active, configurations can be loaded manually");
        return overlay::menu->load();
    }
    catch (const std::exception& error)
    {
        console->print(c_console::log_level::error, "startup failed: %s", error.what());
        return 1;
    }
}
