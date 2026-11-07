#pragma once
#include <cmath>

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
#include <source/utils/console/console.hpp>

// Remove the global union definition from header
// union convertion
// {
//     std::uint64_t hex;
//     float f;
// } conv;

namespace sdk
{
    class c_humanoid : public c_instance
    {
    public:
        using c_instance::c_instance;

        float get_health() const
        {
            float value = g_memory->read<float>(this->address + offsets::humanoid::health);
            return std::isfinite(value) && value >= 0 ? value : 0.0f;
        }

        float get_max_health() const
        {
            float value = g_memory->read<float>(this->address + offsets::humanoid::max_health);
            return std::isfinite(value) && value >= 0 ? value : 0.0f;
        }

        vector3_t get_camera_offset() const
        {
            return g_memory->read<vector3_t>(address + offsets::humanoid::camera_offset);
        }

        void set_camera_offset(const vector3_t& value) const
        {
            g_memory->write(address + offsets::humanoid::camera_offset, value);
        }

        float get_hip_height() const
        {
            return g_memory->read< float >(this->address + offsets::humanoid::hip_height);
        }

        float get_jump_power() const
        {
            return g_memory->read< float >(this->address + offsets::humanoid::jump_power);
        }

        float get_walk_speed() const
        {
            return g_memory->read< float >(this->address + offsets::humanoid::walk_speed);
        }

        void set_health(const float value) const
        {
            g_memory->write< float >(this->address + offsets::humanoid::health, value);
        }

        void set_max_health(const float value) const
        {
            g_memory->write< float >(this->address + offsets::humanoid::max_health, value);
        }

        void set_hip_height(const float value) const
        {
            g_memory->write< float >(this->address + offsets::humanoid::hip_height, value);
        }

        void set_jump_power(const float value) const
        {
            g_memory->write< float >(this->address + offsets::humanoid::jump_power, value);
        }

        void set_walk_speed(const float value) const
        {
            g_memory->write< float >(this->address + offsets::humanoid::walk_speed, value);
            g_memory->write< float >(this->address + offsets::humanoid::walk_speed_check, value);
        }
    };
}