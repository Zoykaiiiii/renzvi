#pragma once
#include "vector3_t.hpp"
#include "matrix3_t.hpp"

namespace sdk
{
	struct cframe_t
	{
		matrix3_t m_rotation;
		vector3_t m_translation;

        //float r00, r01, r02;
        //float r10, r11, r12;
        //float r20, r21, r22;

        //float m_x, m_y, m_z;
        //
        //inline sdk::vector3_t get_look_vector_from_matrix() {
        //    return { r00, r10, r20 };
        //}
        //inline sdk::vector3_t get_right_vector_from_matrix() {
        //    return { r01, r11, r21 };
        //}
        //inline sdk::vector3_t get_up_vector_from_matrix() {
        //    return { -r02, -r12, -r22 };
        //}

	};
    static_assert(sizeof(cframe_t) == 12 * sizeof(float));

    //inline cframe_t lookat(const vector3_t& pos, const vector3_t& target, const vector3_t& up = { 0,1,0 })
    //{
    //    vector3_t forward = (target - pos).normalize();
    //    vector3_t right = up.cross(forward).normalize();
    //    vector3_t realUp = forward.cross(right);

    //    cframe_t result;

    //    result.r00 = right.m_x;  result.r01 = right.m_y;  result.r02 = right.m_z;
    //    result.r10 = realUp.m_x; result.r11 = realUp.m_y; result.r12 = realUp.m_z;
    //    result.r20 = -forward.m_x; result.r21 = -forward.m_y; result.r22 = -forward.m_z;

    //    result.m_x = pos.m_x;
    //    result.m_y = pos.m_y;
    //    result.m_z = pos.m_z;

    //    return result;
    //}


}