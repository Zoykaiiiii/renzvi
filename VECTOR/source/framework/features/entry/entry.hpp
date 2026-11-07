#pragma once
#include <memory>
#include <windows.h>
#include <thread>
#include <chrono>

#include <source/utils/memory/memory.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/framework/features/functions/exploits/exploits.hpp>
#include <source/framework/features/functions/aimbot/aimbot.hpp>
#include <source/framework/features/functions/silent_aim/silent_aim.hpp>
namespace features 
{
    class c_entry 
    {
    public:
        void initialize();
    }; inline std::unique_ptr<c_entry> entry = std::make_unique<c_entry>();
}