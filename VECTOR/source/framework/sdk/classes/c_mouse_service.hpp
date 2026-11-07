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

namespace sdk
{
	class c_mouse_service : public c_instance
	{
	public:
		using c_instance::c_instance;
		inline void set_mouse(sdk::vector2_t position) const
		{
			g_memory->write<float>(this->address + sdk::offsets::mouseservice::mouse_position_y, position.m_y);
			g_memory->write<float>(this->address + sdk::offsets::mouseservice::mouse_position_x, position.m_x);
		}
	};
}
