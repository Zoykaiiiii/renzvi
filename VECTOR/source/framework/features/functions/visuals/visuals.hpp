#pragma once

#include <memory>

#include <d3d11.h>

namespace features
{
	class c_visuals
	{
	public:
		void initialize();

        inline ImU32 lerp(ImU32 color1, ImU32 color2, float t) {
            ImU32 r1 = (color1 >> 16) & 0xFF;
            ImU32 g1 = (color1 >> 8) & 0xFF;
            ImU32 b1 = color1 & 0xFF;
            ImU32 a1 = (color1 >> 24) & 0xFF;

            ImU32 r2 = (color2 >> 16) & 0xFF;
            ImU32 g2 = (color2 >> 8) & 0xFF;
            ImU32 b2 = color2 & 0xFF;
            ImU32 a2 = (color2 >> 24) & 0xFF;

            ImU32 r = r1 + static_cast<ImU32>((r2 - r1) * t);
            ImU32 g = g1 + static_cast<ImU32>((g2 - g1) * t);
            ImU32 b = b1 + static_cast<ImU32>((b2 - b1) * t);
            ImU32 a = a1 + static_cast<ImU32>((a2 - a1) * t);

            return (a << 24) | (r << 16) | (g << 8) | b;
        }

        static inline ID3D11ShaderResourceView* skeletonhead = nullptr;
        static inline ID3D11ShaderResourceView* skeletontorso = nullptr;
        static inline ID3D11ShaderResourceView* skeletonrightarm = nullptr;
        static inline ID3D11ShaderResourceView* skeletonleftarm = nullptr;
        static inline ID3D11ShaderResourceView* skeletonrightleg = nullptr;
        static inline ID3D11ShaderResourceView* skeletonleftleg = nullptr;
        static inline ID3D11ShaderResourceView* boximage = nullptr;
	}; inline std::unique_ptr<c_visuals> visuals = std::make_unique<c_visuals>();
}