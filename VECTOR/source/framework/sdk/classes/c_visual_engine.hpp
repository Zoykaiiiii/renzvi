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
    class c_visual_engine : public std::enable_shared_from_this<c_visual_engine> {
    public:
        c_visual_engine(std::uint64_t address) : address(address) {};
        std::uint64_t address;

        inline vector2_t get_view_port() const
        {
            return g_memory->read<vector2_t>(this->address + offsets::visualengine::view_port);
        }

        inline matrix_t get_view_matrix() const
        {
            return g_memory->read<matrix_t>(this->address + offsets::visualengine::view_matrix);
        }

        inline vector2_t world_to_screen(const vector3_t& point, const vector2_t& view_port, const auto& data) const
        {
            vector4_t clip_space;
            clip_space.m_x = (point.m_x * data[0]) + (point.m_y * data[1]) + (point.m_z * data[2]) + data[3];
            clip_space.m_y = (point.m_x * data[4]) + (point.m_y * data[5]) + (point.m_z * data[6]) + data[7];
            clip_space.m_z = (point.m_x * data[8]) + (point.m_y * data[9]) + (point.m_z * data[10]) + data[11];
            clip_space.m_w = (point.m_x * data[12]) + (point.m_y * data[13]) + (point.m_z * data[14]) + data[15];

            if (clip_space.m_w < 0.1f)
            {
                return{ -1, -1 };
            }

            float inv_w = 1.0f / clip_space.m_w;

            vector3_t ndc;

            ndc.m_x = clip_space.m_x * inv_w;
            ndc.m_y = clip_space.m_y * inv_w;
            ndc.m_z = clip_space.m_z * inv_w;

            return
            {
                (view_port.m_x / 2 * ndc.m_x) + (ndc.m_x + view_port.m_x / 2),
                -(view_port.m_y / 2 * ndc.m_y) + (ndc.m_y + view_port.m_y / 2)
            };
        }
    };
}
