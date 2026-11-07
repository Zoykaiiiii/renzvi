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
#include <source/framework/sdk/classes/c_visual_engine.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/utils/console/console.hpp>

namespace sdk
{
	class c_renderview : public std::enable_shared_from_this<c_renderview>
	{
	public:
		c_renderview(std::uint64_t address) : address(address) {};

		std::uint64_t address;

		std::shared_ptr<c_visual_engine> get_visual_engine() const
		{
			return nullptr; // Unresolved in the supplied dump; main uses VisualEngine.Pointer.
		}
	};
}