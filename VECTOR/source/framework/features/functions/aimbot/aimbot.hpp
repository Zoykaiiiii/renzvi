#pragma once

#include <memory>
#include <vector>
#include <algorithm>
#include <cmath>

#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/sdk/classes/c_primitives.hpp>
#include <source/framework/globals/globals.hpp>

namespace features
{
    class c_player_lock
    {
    public:
        static void update();
        static std::string get_part_name();
        static sdk::vector3_t get_target_position();
        static entity* find_closest_target();
        static bool has_valid_target();
        static void clear_target() { globals->aimlock_current_target = nullptr; }
    };
}
 // it works for arsenal wait