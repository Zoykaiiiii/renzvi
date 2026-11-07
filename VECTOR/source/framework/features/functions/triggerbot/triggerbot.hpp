#pragma once

#include <source/framework/globals/globals.hpp>
#include <source/framework/sdk/includes.hpp>

namespace features {
    class c_triggerbot {
    public:
        static void initialize();
        static void update();
        
    private:
        static bool is_target_in_fov(const sdk::vector3_t& target_pos);
        static void send_click();
    };
}
