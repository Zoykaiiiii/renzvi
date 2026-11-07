#pragma once

#include <algorithm>
#include <cstdint>
#include <iomanip>
#include <iostream>

namespace sdk
{
	struct vector4_t
	{
		float m_x, m_y, m_z, m_w;

 /*       void normalize()
        {
            float mag = std::sqrt(m_w * m_w + m_x * m_x + m_y * m_y + m_z * m_z);
            if (mag > 0)
            {
                m_w /= mag;
                m_x /= mag;
                m_y /= mag;
                m_z /= mag;
            }
        }


        static vector4_t from_matrix(const matrix3_t::matrix3x3_t& m)
        {
            vector4_t q;
            float trace = m.r00 + m.r11 + m.r22;
            if (trace > 0)
            {
                float s = std::sqrt(trace + 1.0f) * 2.0f;
                q.m_w = 0.25f * s;
                q.m_x = (m.r21 - m.r12) / s;
                q.m_y = (m.r02 - m.r20) / s;
                q.m_z = (m.r10 - m.r01) / s;
            }
            else if ((m.r00 > m.r11) && (m.r00 > m.r22))
            {
                float s = std::sqrt(1.0f + m.r00 - m.r11 - m.r22) * 2.0f;
                q.m_w = (m.r21 - m.r12) / s;
                q.m_x = 0.25f * s;
                q.m_y = (m.r01 + m.r10) / s;
                q.m_z = (m.r02 + m.r20) / s;
            }
            else if (m.r11 > m.r22)
            {
                float s = std::sqrt(1.0f + m.r11 - m.r00 - m.r22) * 2.0f;
                q.m_w = (m.r02 - m.r20) / s;
                q.m_x = (m.r01 + m.r10) / s;
                q.m_y = 0.25f * s;
                q.m_z = (m.r12 + m.r21) / s;
            }
            else
            {
                float s = std::sqrt(1.0f + m.r22 - m.r00 - m.r11) * 2.0f;
                q.m_w = (m.r10 - m.r01) / s;
                q.m_x = (m.r02 + m.r20) / s;
                q.m_y = (m.r12 + m.r21) / s;
                q.m_z = 0.25f * s;
            }
            q.normalize();
            return q;
        }

        matrix3_t::matrix3x3_t to_matrix()
        {
            matrix3_t::matrix3x3_t m;

            float xx = m_x * m_x;
            float yy = m_y * m_y;
            float zz = m_z * m_z;

            float xy = m_x * m_y;
            float xz = m_x * m_z;
            float yz = m_y * m_z;

            float wx = m_w * m_x;
            float wy = m_w * m_y;
            float wz = m_w * m_z;


            m.r00 = 1.0f - 2.0f * (yy + zz);
            m.r01 = 2.0f * (xy - wz);
            m.r02 = 2.0f * (xz + wy);

            m.r10 = 2.0f * (xy + wz);
            m.r11 = 1.0f - 2.0f * (xx + zz);
            m.r12 = 2.0f * (yz - wx);

            m.r20 = 2.0f * (xz - wy);
            m.r21 = 2.0f * (yz + wx);
            m.r22 = 1.0f - 2.0f * (xx + yy);

            return m;
        }
        static float dot(const vector4_t& a, const vector4_t& b)
        {
            return a.m_w * b.m_w + a.m_x * b.m_x + a.m_y * b.m_y + a.m_z * b.m_z;
        }

        static vector4_t slerp(const vector4_t& a, const vector4_t& b, float t)
        {
            t = std::clamp(t, 0.0f, 1.0f);
            vector4_t end = b;
            float cosTheta = dot(a, b);

            if (cosTheta < 0.0f)
            {
                end.m_w = -b.m_w; end.m_x = -b.m_x; end.m_y = -b.m_y; end.m_z = -b.m_z;
                cosTheta = -cosTheta;
            }

            if (cosTheta > 0.9995f)
            {
                vector4_t result = {
                    a.m_w + t * (end.m_w - a.m_w),
                    a.m_x + t * (end.m_x - a.m_x),
                    a.m_y + t * (end.m_y - a.m_y),
                    a.m_z + t * (end.m_z - a.m_z)
                };
                result.normalize();
                return result;
            }

            float angle = std::acos(cosTheta);
            float sinAngle = std::sqrt(1.0f - cosTheta * cosTheta);
            float invSin = 1.0f / sinAngle;

            float factorA = std::sin((1.0f - t) * angle) * invSin;
            float factorB = std::sin(t * angle) * invSin;

            return {
                factorA * a.m_w + factorB * end.m_w,
                factorA * a.m_x + factorB * end.m_x,
                factorA * a.m_y + factorB * end.m_y,
                factorA * a.m_z + factorB * end.m_z
            };
        }*/
	};
}