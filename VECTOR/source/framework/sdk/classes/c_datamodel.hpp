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
    class c_instance;

    class c_datamodel : public c_instance
    {
    public:
        using c_instance::c_instance;

        inline std::shared_ptr<sdk::c_datamodel> get_datamodel(uintptr_t base) const
        {
            std::uint64_t data_model = g_memory->read<std::uint64_t>(base + offsets::datamodel::pointer);
            std::uint64_t real_address = g_memory->read<std::uint64_t>(data_model + offsets::datamodel::realdatamodel);
            return std::make_shared<sdk::c_datamodel>(real_address);
        }


        inline std::uint64_t get_game_id() const
        {
            return g_memory->read<std::uint64_t>(this->address + offsets::datamodel::gameid);
        }

        inline bool is_loaded() const
        {
            return g_memory->read<bool>(this->address + offsets::datamodel::is_loaded);
        }
    }; 
}
