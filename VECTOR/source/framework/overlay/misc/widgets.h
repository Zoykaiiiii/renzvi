#pragma once
#define IMGUI_DEFINE_MATH_OPERATORS

#include <source/utils/imgui/imgui.h>
#include "style.h"
#include <vector>
#include <string>
#include <windows.h>
#include <algorithm>
#include <unordered_map>

namespace Widgets
{
    struct Tag {
        ImVec2 pos;
        ImVec2 size;
        std::string text;
        ImU32 border_col;
        ImU32 border_inner_col;
    };

    extern std::vector<Tag> tags;

    void DrawBorder(ImDrawList* dl, ImVec2 pos, ImVec2 sz, ImU32 col, int inset = 0);

    bool Checkbox(const char* label, bool* v);
    int SubTab(const char* labels[], int count, int& current, ImVec2 start, float width);

    bool BeginTag(const char* id, const char* text, const ImVec2& size, ImU32 border_col = ImColor(Style::Border), ImU32 border_inner_col = ImColor(Style::BorderInner), ImGuiWindowFlags flags = 0);

    void EndTag();
    void RenderTags();

    struct Hotkey {
        enum HotkeyType { TOGGLE, HOLD, ALWAYS };
        const char* name;
        int key = 0;
        HotkeyType type = TOGGLE;
        bool enabled = false;
        bool waiting = false;
        bool menu = false;
        bool release_wait = false;

        Hotkey(const char* n) : name(n) {}
        void Update();
        std::string KeyName();
        std::string TypeName();
        bool Capture();
    };

    bool DrawHotkey(Hotkey* hk, const char* label, bool show_label, ImGuiButtonFlags flags = 0);
    bool Dropdown(const char* id, const char* label, const std::vector<const char*>& items, int* current_item, bool show_label = true);

    inline void OpenConfirm(const char* id) { ImGui::OpenPopup(id); }
    int ConfirmPopup(const char* id, const char* text, const char* yes_label = "Yes", const char* no_label = "No", ImVec2 min_size = ImVec2(420, 150));

    bool BeginFrameWindow(const char* title, const ImVec2& min_size);
    void EndFrameWindow();

    struct Console {
        enum Filter { ALL, SUCCESS, WARN, INFO, DEBUG };

        ImGuiTextBuffer buf;
        ImVector<int>   line_offsets;
        ImVector<ImU32> line_colors;
        ImVector<Filter> line_types;
        bool autoscroll = true;
        Filter current_filter = ALL;

        void Clear();
        void Add(ImU32 color, Filter type, const char* fmt, ...) IM_FMTARGS(4);
        void Draw(const char* id, const ImVec2& size);
    };

    extern Console ConsoleInstance;

    void LogSuccess(const char* fmt, ...) IM_FMTARGS(1);
    void LogWarn(const char* fmt, ...) IM_FMTARGS(1);
    void LogInfo(const char* fmt, ...) IM_FMTARGS(1);
    void LogDebug(const char* fmt, ...) IM_FMTARGS(1);

    bool AnimatedTextbox(const char* id, const char* label, char* buf, size_t buf_size, bool show_label = true);
    bool AnimatedCombo(const char* id, const char* label, const std::vector<const char*>& items, int* current_item, bool show_label = true);
    void DrawAnimatedGroundBox(ImVec2 center, float radius, float time);
}
