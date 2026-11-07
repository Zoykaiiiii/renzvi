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
	class c_camera;

	class c_workspace : public c_instance
	{
	public:
		using c_instance::c_instance;

		inline std::shared_ptr<c_camera> get_camera() const
		{
			return std::make_shared<c_camera>(g_memory->read<std::uint64_t>(this->address + offsets::workspace::camera));
		}
	};
}
