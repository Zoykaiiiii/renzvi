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
#include <source/framework/sdk/classes/c_player.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/utils/console/console.hpp>

namespace sdk
{
    class c_players : public c_instance
    {
    public:
        using c_instance::c_instance;

        inline std::vector<std::shared_ptr<c_player>> get_players() const
        {
            std::vector<std::shared_ptr<c_player>> players = {};
            std::vector<std::shared_ptr<c_instance>> children = this->get_children();

            players.reserve(children.size());

            for (const std::shared_ptr<c_instance> child : children)
            {
                players.emplace_back(std::make_shared<c_player>(child->address));
            }

            return players;
        }

        inline std::shared_ptr<c_player> get_local_player() const
        {
            return std::make_shared<c_player>(g_memory->read<std::uint64_t>(this->address + offsets::players::local_player));
        }
    };
}