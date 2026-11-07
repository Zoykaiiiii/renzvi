#pragma once

#include "../../../utils/memory/memory.hpp"
#include "../offsets/offsets.hpp"
#include "../math/cframe_t.hpp"
#include "../math/matrix_t.hpp"
#include "../math/matrix3_t.hpp"
#include "../math/matrix4_t.hpp"
#include "../math/vector2_t.hpp"
#include "../math/vector3_t.hpp"
#include "../math/vector4_t.hpp"

#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/utils/console/console.hpp>

namespace sdk
{
    class c_player : public c_instance
    {
    public:
        using c_instance::c_instance;

        inline std::string get_display() const
        {
            std::uint64_t name = g_memory->read< std::uint64_t >(this->address + offsets::player::display);

            return name ? g_memory->read_string(name) : "NULL";
        }

        inline std::shared_ptr< c_instance > get_team() const
        {
            return std::make_shared< c_instance >(g_memory->read<std::uint64_t>(this->address + offsets::player::team));
        }

        inline std::uint64_t get_user_id() const
        {
            return g_memory->read< std::uint64_t >(this->address + offsets::player::user_id);
        }

        inline std::shared_ptr<c_instance> get_character() const
        {
            uint64_t addr = g_memory->read<uint64_t>(this->address + offsets::player::character);
            return addr ? std::make_shared<c_instance>(addr) : nullptr;
        }

        inline std::string get_animation_id() const
        {
            return g_memory->read_string(this->address + offsets::player::animation_id);
        }
    };
}
