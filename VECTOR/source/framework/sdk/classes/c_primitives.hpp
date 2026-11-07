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
#include <source/utils/console/console.hpp>

namespace sdk 
{
	class c_primitives : public c_instance
	{
	public:
		using c_instance::c_instance;

		inline std::shared_ptr<c_primitives> get_primitive() const 
		{
			return std::make_shared<c_primitives>(g_memory->read<std::uint64_t>(this->address + offsets::primitives::primitive));
		}

		inline uintptr_t primitive_address() const
		{
			uint64_t addr = g_memory->read<uint64_t>(this->address + offsets::primitives::primitive);
            return addr ? addr : 0;
		}

        inline matrix3_t get_rotation() const
        {
            uintptr_t addr = primitive_address();
            return  g_memory->read<matrix3_t>(addr + offsets::primitives::rotation);
        }



        inline vector3_t get_translation() const
        {
            uintptr_t addr = primitive_address();
            return  g_memory->read<vector3_t>(addr + offsets::primitives::translation);
        }

        inline vector3_t get_velocity() const
        {
            uintptr_t addr = primitive_address();
            return  g_memory->read<vector3_t>(addr + offsets::primitives::velocity);
        }

        inline vector3_t get_size() const
        {
            uintptr_t addr = primitive_address();
            return  g_memory->read<vector3_t>(addr + offsets::primitives::size);
        }

        inline cframe_t get_cframe() const
        {
            uintptr_t addr = primitive_address();
            return g_memory->read<cframe_t>(addr + offsets::primitives::cframe);
        }

        inline void set_rotation(const matrix3_t& value)
        {
            uintptr_t addr = primitive_address();
            for (int i = 0; i < 1000; i++) {
                g_memory->write<matrix3_t>(addr + offsets::primitives::rotation, value);
            }
        }



        inline void set_cframe(const cframe_t& value)
        {
            uintptr_t addr = primitive_address();
            g_memory->write<cframe_t>(addr + offsets::primitives::cframe, value);
        }

        inline void set_translation(const vector3_t& value)
        {
            uintptr_t addr = primitive_address();
            for (int i = 0; i < 1000; i++) {
                g_memory->write<vector3_t>(addr + offsets::primitives::translation, value);
            }
        }

        inline void set_velocity(const vector3_t& value)
        {
            uintptr_t addr = primitive_address();
            for (int i = 0; i < 1000; i++) {
                g_memory->write<vector3_t>(addr + offsets::primitives::velocity, value);
            }
        }

        inline void set_size(const vector3_t& value)
        {
            uintptr_t addr = primitive_address();
            g_memory->write<vector3_t>(addr + offsets::primitives::size, value);
        }
	};
}