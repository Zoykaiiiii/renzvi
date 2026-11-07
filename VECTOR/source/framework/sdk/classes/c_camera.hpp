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

#include <numbers>

namespace sdk
{
    class c_camera : public c_instance
    {
    public:
        using c_instance::c_instance;

        inline matrix3_t get_camera_rotation() const
        {
            return g_memory->read< matrix3_t >(this->address + offsets::camera::rotation);
        }

        inline vector3_t get_camera_translation() const
        {
            return g_memory->read< vector3_t >(this->address + offsets::camera::translation);
        }


        inline float get_fov() const
        {
            float fov = g_memory->read< float >(this->address + offsets::camera::field_of_view);

            return fov * 180 / std::numbers::pi_v< float >;
        }

        inline void set_camera_rotation(const matrix3_t value) const
        {
            g_memory->write< matrix3_t >(this->address + offsets::camera::rotation, value);

        }

        inline void set_camera_translation(const vector3_t value) const
        {
            g_memory->write< vector3_t >(this->address + offsets::camera::translation, value);
        }


        inline void set_fov(const float value) const
        {
            float fov = value * std::numbers::pi_v< float > / 180;

            g_memory->write< float >(this->address + offsets::camera::field_of_view, fov);
        }
    };
}