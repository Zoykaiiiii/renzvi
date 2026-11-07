#pragma once

#include <cmath>

namespace sdk
{

	struct vector3_t
	{
		float m_x, m_y, m_z;

		float magnitude() const {
			return std::sqrt(m_x * m_x + m_y * m_y + m_z * m_z);
		}
		const vector3_t normalize() const noexcept
		{
			float lengthSquared = m_x * m_x + m_y * m_y + m_z * m_z;
			if (lengthSquared > 0) {
				float invLength = 1.0f / sqrtf(lengthSquared);
				return { m_x * invLength, m_y * invLength, m_z * invLength };
			}
			return *this; 
		}

		auto cross(vector3_t vec) const
		{
			vector3_t ret;
			ret.m_x = m_y * vec.m_z - m_z * vec.m_y;
			ret.m_y = -(m_x * vec.m_z - m_z * vec.m_x);
			ret.m_z = m_x * vec.m_y - m_y * vec.m_x;
			return ret;
		}

        vector3_t operator+(const vector3_t& rhs) const {
            return { m_x + rhs.m_x, m_y + rhs.m_y, m_z + rhs.m_z };
        }

        vector3_t operator-(const vector3_t& rhs) const {
            return { m_x - rhs.m_x, m_y - rhs.m_y, m_z - rhs.m_z };
        }

        vector3_t operator*(float scalar) const {
            return { m_x * scalar, m_y * scalar, m_z * scalar };
        }

        vector3_t operator/(float scalar) const {
            return { m_x / scalar, m_y / scalar, m_z / scalar };
        }
	};
}