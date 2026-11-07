#pragma once
#include <cmath>
#include "vector3_t.hpp"

namespace sdk
{
	struct matrix3_t
	{
		float m_data[3][3]{};

		float* operator[](int row) {
			return m_data[row];
		}

		const float* operator[](int row) const {
			return m_data[row];
		}
		vector3_t operator*(const vector3_t& v) const {
			return vector3_t(
				m_data[0][0] * v.m_x + m_data[0][1] * v.m_y + m_data[0][2] * v.m_z,
				m_data[1][0] * v.m_x + m_data[1][1] * v.m_y + m_data[1][2] * v.m_z,
				m_data[2][0] * v.m_x + m_data[2][1] * v.m_y + m_data[2][2] * v.m_z
			);
		}

		static matrix3_t identity() {
			matrix3_t mat{};
			for (int i = 0; i < 3; ++i) {
				for (int j = 0; j < 3; ++j) {
					mat.m_data[i][j] = (i == j) ? 1.0f : 0.0f;
				}
			}
			return mat;
		}

		static matrix3_t from_euler(float pitch, float yaw, float roll)
		{
			float cp = cosf(pitch);
			float sp = sinf(pitch);
			float cy = cosf(yaw);
			float sy = sinf(yaw);
			float cr = cosf(roll);
			float sr = sinf(roll);

			matrix3_t mat{};

			mat.m_data[0][0] = cy * cr;
			mat.m_data[0][1] = cy * sr;
			mat.m_data[0][2] = -sy;

			mat.m_data[1][0] = sp * sy * cr - cp * sr;
			mat.m_data[1][1] = sp * sy * sr + cp * cr;
			mat.m_data[1][2] = sp * cy;

			mat.m_data[2][0] = cp * sy * cr + sp * sr;
			mat.m_data[2][1] = cp * sy * sr - sp * cr;
			mat.m_data[2][2] = cp * cy;
			return mat;
		}
	};
    static_assert(sizeof(matrix3_t) == 9 * sizeof(float));
}