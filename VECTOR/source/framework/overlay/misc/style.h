#pragma once
#include <source/utils/imgui/imgui.h>

namespace Style
{
    inline ImVec4 Border       = ImVec4(0.090, 0.090, 0.118, 1.0);
    inline ImVec4 BorderChild  = ImVec4(18 / 255.f, 18 / 255.f, 26 / 255.f, 1.0f);
    inline ImVec4 BorderInner  = ImVec4(0.243, 0.243, 0.282, 1.0);

    inline ImVec4 WindowBg     = ImVec4(0.153, 0.153, 0.184, 1.0);
    inline ImVec4 Accent       = ImVec4(206 / 255.f, 115 / 255.f, 136 / 255.f, 1.0f);

    inline ImVec4 MainChildBg  = ImVec4(23/255.f, 23/255.f, 30/255.f, 1.0f);
    inline ImVec4 InnerChildBg = ImVec4(32/255.f, 32/255.f, 38/255.f, 1.0f);

    inline ImFont* FontRegular = nullptr;
    inline ImFont* FontBold    = nullptr;

    inline void Setup()
    {
        auto& s = ImGui::GetStyle();
        auto  c = s.Colors;
        c[ImGuiCol_WindowBg] = WindowBg;
        c[ImGuiCol_Text] = ImVec4(205 / 255.f, 205 / 255.f, 205 / 255.f, 1.0f);
    }
}
