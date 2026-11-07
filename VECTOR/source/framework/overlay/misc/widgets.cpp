#include "widgets.h"
#define IMGUI_DEFINE_MATH_OPERATORS

#include <source/utils/imgui/imgui.h>
#include <source/utils/imgui/imgui_internal.h>
#include <cstdarg>
#include <unordered_map>
#include <cmath>
#include <set>

namespace Widgets
{
    std::vector<Tag> tags;

    void DrawBorder(ImDrawList* dl, ImVec2 pos, ImVec2 sz, ImU32 col, int inset)
    {
        float x0 = (float)(int)pos.x + inset;
        float y0 = (float)(int)pos.y + inset;
        float x1 = (float)(int)(pos.x + sz.x) - inset;
        float y1 = (float)(int)(pos.y + sz.y) - inset;

        dl->AddRectFilled(ImVec2(x0, y0), ImVec2(x1, y0 + 1), col);
        dl->AddRectFilled(ImVec2(x0, y1 - 1), ImVec2(x1, y1), col);
        dl->AddRectFilled(ImVec2(x0, y0 + 1), ImVec2(x0 + 1, y1 - 1), col);
        dl->AddRectFilled(ImVec2(x1 - 1, y0 + 1), ImVec2(x1, y1 - 1), col);
    }

    bool Checkbox(const char* label, bool* v)
    {
        ImGuiWindow* window = ImGui::GetCurrentWindow();
        if (window->SkipItems)
            return false;

        ImGuiContext& g = *GImGui;
        const ImGuiStyle& style = g.Style;
        const ImGuiID id = window->GetID(label);

        ImVec2 label_size = ImGui::CalcTextSize(label, NULL, true);
        float box_size = 8.0f;
        ImVec2 pos = window->DC.CursorPos;

        ImRect total_bb(pos, ImVec2(pos.x + box_size + 12.0f + label_size.x, pos.y + box_size));

        float pad_x = 16.0f;
        float pad_y = 6.0f;
        total_bb.Min.x -= pad_x;
        total_bb.Min.y -= pad_y;
        total_bb.Max.x += pad_x;
        total_bb.Max.y += pad_y;

        ImGui::ItemSize(total_bb, style.FramePadding.y);
        if (!ImGui::ItemAdd(total_bb, id))
            return false;


        bool hovered, held;
        bool pressed = ImGui::ButtonBehavior(total_bb, id, &hovered, &held);

        if (pressed)
            *v = !*v;

        ImRect check_bb(pos, ImVec2(pos.x + box_size, pos.y + box_size));

        window->DrawList->AddRect(
            ImVec2(check_bb.Min.x - 1.0f, check_bb.Min.y - 1.0f),
            ImVec2(check_bb.Max.x + 1.0f, check_bb.Max.y + 1.0f),
            IM_COL32(18, 18, 24, 255),
            0.0f, 0, 1.0f
        );

        if (*v)
        {
            ImVec4 accent_top(
                Style::Accent.x * 1.35f,
                Style::Accent.y * 1.35f,
                Style::Accent.z * 1.35f,
                Style::Accent.w
            );
            if (hovered)
            {
                accent_top.x = ImClamp(accent_top.x * 1.1f, 0.0f, 1.0f);
                accent_top.y = ImClamp(accent_top.y * 1.1f, 0.0f, 1.0f);
                accent_top.z = ImClamp(accent_top.z * 1.1f, 0.0f, 1.0f);
            }
            ImU32 col_top = ImGui::GetColorU32(accent_top);
            ImU32 col_bottom = ImGui::GetColorU32(Style::Accent);
            window->DrawList->AddRectFilledMultiColor(
                check_bb.Min, check_bb.Max,
                col_top, col_top, col_bottom, col_bottom
            );
        }
        else
        {
            ImVec4 col_inactive = ImVec4(0x4B / 255.f, 0x4B / 255.f, 0x56 / 255.f, 1.0f);
            if (hovered)
            {
                col_inactive.x = ImClamp(col_inactive.x * 1.2f, 0.0f, 1.0f);
                col_inactive.y = ImClamp(col_inactive.y * 1.2f, 0.0f, 1.0f);
                col_inactive.z = ImClamp(col_inactive.z * 1.2f, 0.0f, 1.0f);
            }
            window->DrawList->AddRectFilled(check_bb.Min, check_bb.Max, ImGui::GetColorU32(col_inactive));
        }

        ImVec2 label_pos(check_bb.Max.x + 12.0f, pos.y + (box_size - label_size.y) * 0.5f);

        ImU32 text_col;
        if (*v)
            text_col = IM_COL32(255, 255, 255, 255);
        else if (hovered)
            text_col = IM_COL32(225, 225, 230, 255);
        else
            text_col = ImGui::GetColorU32(ImGuiCol_Text);

        if (label_size.x > 0.0f)
            window->DrawList->AddText(label_pos, text_col, label);

        return pressed;
    }

    int SubTab(const char* labels[], int count, int& current, ImVec2 start, float width)
    {
        ImDrawList* dl = ImGui::GetWindowDrawList();
        float h = 26.0f;

        float margin_x = 12.0f;
        float margin_y = 12.0f;

        float top = start.y + margin_y;
        float x_start = start.x + margin_x;
        float usable_width = width - margin_x * 2;

        float w = usable_width / count;

        for (int i = 0; i < count; i++)
        {
            float x0 = x_start + w * i;
            float x1 = x_start + w * (i + 1);

            ImGui::SetCursorScreenPos(ImVec2(x0, top));
            ImGui::InvisibleButton(labels[i], ImVec2(w, h));
            bool hovered = ImGui::IsItemHovered();
            if (ImGui::IsItemClicked())
                current = i;

            ImU32 tcol, bcol;
            if (i == current)
            {
                tcol = IM_COL32(0x37, 0x37, 0x40, 255);
                bcol = IM_COL32(0x25, 0x25, 0x2D, 255);
            }
            else
            {
                tcol = IM_COL32(0x31, 0x31, 0x3B, 255);
                bcol = IM_COL32(0x18, 0x18, 0x1C, 255);
                if (hovered)
                {
                    tcol = IM_COL32(0x35, 0x35, 0x3F, 255);
                    bcol = IM_COL32(0x20, 0x20, 0x25, 255);
                }
            }

            ImVec2 a(x0, top), b(x1 + 1, top + h + 1);
            dl->AddRectFilledMultiColor(a, b, tcol, tcol, bcol, bcol);

            dl->AddLine(ImVec2(x0, top), ImVec2(x0, b.y), ImGui::GetColorU32(Style::BorderInner));
            dl->AddLine(ImVec2(x1, top), ImVec2(x1, b.y), ImGui::GetColorU32(Style::BorderInner));
            dl->AddLine(ImVec2(x0, top), ImVec2(x1, top), ImGui::GetColorU32(Style::BorderInner));
            dl->AddLine(ImVec2(x0, b.y), ImVec2(x1 + 1, b.y), ImGui::GetColorU32(Style::BorderInner));

            if (i == current)
                dl->AddRectFilled(ImVec2(x0, b.y - 1), ImVec2(x1, b.y), ImGui::GetColorU32(Style::Accent));

            ImVec2 ts = ImGui::CalcTextSize(labels[i]);
            ImVec2 tc(x0 + (w - ts.x) * 0.5f, top + (h - ts.y) * 0.5f - 1.0f);
            ImU32 text_col;
            if (i == current)
                text_col = IM_COL32(255, 255, 255, 255);
            else if (hovered)
                text_col = IM_COL32(235, 235, 240, 255);
            else
                text_col = IM_COL32(200, 200, 205, 255);

            dl->AddText(tc, text_col, labels[i]);
        }

        return current;
    }

    bool BeginTag(const char* id, const char* text, const ImVec2& size, ImU32 border_col, ImU32 border_inner_col, ImGuiWindowFlags flags)
    {
        ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
        bool open = ImGui::BeginChild(id, size, false, flags);

        ImVec2 win_pos = ImGui::GetWindowPos();
        ImVec2 win_size = ImGui::GetWindowSize();
        ImDrawList* dl = ImGui::GetWindowDrawList();

        DrawBorder(dl, win_pos, win_size, border_col);
        DrawBorder(dl, win_pos, win_size, border_inner_col, 1);

        if (text && *text)
            tags.push_back({ win_pos, win_size, text, border_col, border_inner_col });

        return open;
    }

    void EndTag()
    {
        ImGui::EndChild();
        ImGui::PopStyleColor();
    }

    void RenderTags()
    {
        ImDrawList* dl = ImGui::GetForegroundDrawList();
        for (auto& t : tags)
        {
            ImVec2 text_size = Style::FontBold->CalcTextSizeA(
                Style::FontBold->FontSize, FLT_MAX, 0.0f, t.text.c_str());

            float padding_x = 6.f;
            float padding_y = 4.f;

            float rect_w = text_size.x + padding_x * 2.0f;
            float rect_h = text_size.y + padding_y;
            float rect_x = t.pos.x + 16.0f;
            float rect_y = t.pos.y - rect_h * 0.5f;

            ImU32 col_top = ImGui::GetColorU32(Style::InnerChildBg);
            ImU32 col_bottom = ImGui::GetColorU32(Style::MainChildBg);

            float mid_y = rect_y + rect_h * 0.6f;

            dl->AddRectFilled(ImVec2(rect_x, rect_y),
                ImVec2(rect_x + rect_w, mid_y),
                col_top, 0.f);
            dl->AddRectFilled(ImVec2(rect_x, mid_y),
                ImVec2(rect_x + rect_w, rect_y + rect_h),
                col_bottom, 0.f);

            ImVec2 text_pos(rect_x + padding_x,
                rect_y + (rect_h - text_size.y) * 0.5f);

            dl->AddText(Style::FontBold, Style::FontBold->FontSize,
                text_pos,
                ImGui::GetColorU32(ImGuiCol_Text),
                t.text.c_str());
        }
        tags.clear();
    }

    bool Dropdown(const char* id, const char* label, const std::vector<const char*>& items, int* cur, bool show_label)
    {
        ImGuiWindow* W = ImGui::GetCurrentWindow();
        if (W->SkipItems) return false;

        ImGuiContext& G = *GImGui;
        const ImGuiStyle& S = G.Style;

        const char* preview = (*cur >= 0 && *cur < items.size()) ? items[*cur] : "";

        float fw = ImGui::GetContentRegionAvail().x - 68.0f;
        float h = ImGui::GetFrameHeight() * 1.1f;
        ImVec2 sz(fw, h);

        ImVec2 pos = W->DC.CursorPos;
        pos.x += 20.0f;
        pos.y -= 1.0f;

        ImVec2 label_pos = pos;
        if (show_label && label && *label)
            pos.y += ImGui::CalcTextSize(label).y + 4.0f;

        ImRect bb(pos, pos + sz);
        ImGui::ItemSize(bb, S.FramePadding.y);
        if (!ImGui::ItemAdd(bb, W->GetID(id))) return false;

        ImGui::SetCursorScreenPos(pos);
        ImGui::SetNextItemWidth(fw);

        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(8, 8));
        ImGui::PushStyleColor(ImGuiCol_PopupBg, IM_COL32(0, 0, 0, 0));
        ImGui::PushStyleColor(ImGuiCol_Border, IM_COL32(0, 0, 0, 0));

        bool changed = false;
        bool open = ImGui::BeginCombo(("##" + std::string(id)).c_str(), preview, ImGuiComboFlags_NoArrowButton);
        if (open)
        {
            ImGui::SetWindowPos(ImVec2(ImGui::GetWindowPos().x, ImGui::GetWindowPos().y + 4));

            ImVec2 wp = ImGui::GetWindowPos();
            ImVec2 ws = ImGui::GetWindowSize();
            ImDrawList* dl = ImGui::GetWindowDrawList();

            ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
            ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
            ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);

            dl->AddRectFilledMultiColor(wp, wp + ws, ctop, ctop, cbot, cbot);
            dl->AddRect(wp, wp + ws, cbor, 0.0f, 0, 3.5f);

            for (int i = 0; i < items.size(); i++)
            {
                bool sel = (i == *cur);
                ImGui::SetCursorPosX(ImGui::GetCursorPosX() + 6);
                if (ImGui::Selectable(items[i], sel, 0, ImVec2(ImGui::GetContentRegionAvail().x - 6, 0)))
                {
                    *cur = i;
                    changed = true;
                }
                if (sel)
                    ImGui::SetItemDefaultFocus();
            }
            ImGui::Dummy(ImVec2(0, 1.0f));

            ImGui::EndCombo();
        }

        ImGui::PopStyleColor(2);
        ImGui::PopStyleVar();

        bool hov = ImGui::IsItemHovered();
        auto L = [](ImU32 col, float f) {
            ImVec4 c = ImGui::ColorConvertU32ToFloat4(col);
            c.x = ImMin(c.x * f, 1.0f);
            c.y = ImMin(c.y * f, 1.0f);
            c.z = ImMin(c.z * f, 1.0f);
            return ImGui::ColorConvertFloat4ToU32(c);
            };

        ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
        ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
        ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);
        ImU32 ctxt = ImGui::GetColorU32(ImGuiCol_Text);

        if (hov) {
            ctop = L(ctop, 1.15f); cbot = L(cbot, 1.15f); cbor = L(cbor, 1.15f);
            ctxt = L(ctxt, 1.75f);
        }

        W->DrawList->AddRectFilledMultiColor(bb.Min, bb.Max, ctop, ctop, cbot, cbot);
        W->DrawList->AddRect(bb.Min, bb.Max, cbor, S.FrameRounding);

        ImVec2 tsz = ImGui::CalcTextSize(preview);
        ImVec2 tpos = bb.Min + ImVec2(S.FramePadding.x + 3.0f, (sz.y - tsz.y) * 0.5f);
        W->DrawList->AddText(tpos, ctxt, preview);

        float arr = h * 0.15f;
        ImVec2 ctr = ImVec2(bb.Max.x - h * 0.5f, bb.Min.y + h * 0.5f);
        ImU32 acol = hov ? IM_COL32(200, 200, 200, 255) : IM_COL32(160, 160, 160, 255);
        ImU32 shadow_col = IM_COL32(0, 0, 0, 100);

        ImVec2 p1, p2, p3;
        if (open)
        {
            p1 = ImVec2(ctr.x - arr, ctr.y + arr * 0.8f);
            p2 = ImVec2(ctr.x + arr, ctr.y + arr * 0.8f);
            p3 = ImVec2(ctr.x, ctr.y - arr * 0.6f);
        }
        else
        {
            p1 = ImVec2(ctr.x - arr, ctr.y - arr * 0.8f);
            p2 = ImVec2(ctr.x + arr, ctr.y - arr * 0.8f);
            p3 = ImVec2(ctr.x, ctr.y + arr * 0.6f);
        }

        W->DrawList->AddTriangleFilled(p1 + ImVec2(1, 1), p2 + ImVec2(1, 1), p3 + ImVec2(1, 1), shadow_col);
        W->DrawList->AddTriangleFilled(p1, p2, p3, acol);

        if (show_label && label && *label)
        {
            ImU32 lbl_col = ImGui::GetColorU32(ImGuiCol_Text);
            if (hov)
            {
                ImVec4 c = ImGui::ColorConvertU32ToFloat4(lbl_col);
                c.x = ImMin(c.x * 1.5f, 1.0f);
                c.y = ImMin(c.y * 1.5f, 1.0f);
                c.z = ImMin(c.z * 1.5f, 1.0f);
                lbl_col = ImGui::ColorConvertFloat4ToU32(c);
            }
            W->DrawList->AddText(label_pos, lbl_col, label);
        }

        ImGui::Dummy(ImVec2(0.0f, 2.0f));
        return changed;
    }

    static const char* key_names[] = {
        "Unknown","LBUTTON","RBUTTON","CANCEL","MBUTTON","XBUTTON1","XBUTTON2","Unknown",
        "BACK","TAB","Unknown","Unknown","CLEAR","RETURN","Unknown","Unknown",
        "SHIFT","CONTROL","MENU","PAUSE","CAPITAL","KANA","Unknown","JUNJA",
        "FINAL","KANJI","Unknown","ESCAPE","CONVERT","NONCONVERT","ACCEPT","MODECHANGE",
        "SPACE","PRIOR","NEXT","END","HOME","LEFT","UP","RIGHT","DOWN","SELECT",
        "PRINT","EXECUTE","SNAPSHOT","INSERT","DELETE","HELP","0","1","2","3",
        "4","5","6","7","8","9","Unknown","Unknown","Unknown","Unknown",
        "Unknown","Unknown","Unknown","A","B","C","D","E","F","G",
        "H","I","J","K","L","M","N","O","P","Q",
        "R","S","T","U","V","W","X","Y","Z","LWIN",
        "RWIN","APPS","Unknown","SLEEP","NUMPAD0","NUMPAD1","NUMPAD2","NUMPAD3","NUMPAD4","NUMPAD5",
        "NUMPAD6","NUMPAD7","NUMPAD8","NUMPAD9","MULTIPLY","ADD","SEPARATOR","SUBTRACT","DECIMAL","DIVIDE",
        "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10",
        "F11","F12","F13","F14","F15","F16","F17","F18","F19","F20",
        "F21","F22","F23","F24","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown",
        "Unknown","Unknown","NUMLOCK","SCROLL","OEM_NEC_EQUAL","OEM_FJ_MASSHOU","OEM_FJ_TOUROKU","OEM_FJ_LOYA","OEM_FJ_ROYA","Unknown",
        "Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","LSHIFT","RSHIFT","LCONTROL",
        "RCONTROL","LMENU","RMENU"
    };

    void Hotkey::Update()
    {
        switch (type) {
        case TOGGLE:
            if (GetAsyncKeyState(key) & 1) enabled = !enabled;
            break;
        case HOLD:
            enabled = (GetAsyncKeyState(key) & 0x8000);
            break;
        case ALWAYS:
            enabled = true;
            break;
        }
    }

    std::string Hotkey::KeyName()
    {
        if (!key) return "";
        std::string tmp = key_names[key];
        std::transform(tmp.begin(), tmp.end(), tmp.begin(), ::toupper);
        return tmp;
    }

    std::string Hotkey::TypeName()
    {
        switch (type) {
        case TOGGLE: return "toggle";
        case HOLD: return "hold";
        case ALWAYS: return "always";
        }
        return "";
    }

    bool Hotkey::Capture()
    {
        ImGuiIO& io = ImGui::GetIO();
        if (!release_wait) {
            for (int i = 0; i < 5; i++) if (io.MouseDown[i]) return false;
            for (int i = VK_BACK; i <= VK_RMENU; i++) if (GetAsyncKeyState(i) & 0x8000) return false;
            release_wait = true;
            return false;
        }
        for (int i = 0; i < 5; i++) if (io.MouseClicked[i]) {
            key = (i == 0 ? VK_LBUTTON : i == 1 ? VK_RBUTTON : i == 2 ? VK_MBUTTON : i == 3 ? VK_XBUTTON1 : VK_XBUTTON2);
            release_wait = false;
            return true;
        }
        for (int i = VK_BACK; i <= VK_RMENU; i++) if (GetAsyncKeyState(i) & 1) {
            key = i;
            release_wait = false;
            return true;
        }
        return false;
    }

    bool DrawHotkey(Hotkey* hk, const char* lbl, bool show_lbl, ImGuiButtonFlags flags)
    {
        ImGuiWindow* win = ImGui::GetCurrentWindow();
        if (win->SkipItems) return false;

        ImGuiContext& g = *GImGui;
        const ImGuiStyle& st = g.Style;
        const ImGuiID id = win->GetID(hk->name);

        float fw = ImGui::GetContentRegionAvail().x - 68.0f;
        float h = ImGui::GetFrameHeight() * 1.1f;
        ImVec2 sz(fw, h);

        ImVec2 pos = win->DC.CursorPos;
        pos.x += 20.0f;

        auto L = [](ImU32 col, float f) {
            ImVec4 c = ImGui::ColorConvertU32ToFloat4(col);
            c.x = ImMin(c.x * f, 1.0f);
            c.y = ImMin(c.y * f, 1.0f);
            c.z = ImMin(c.z * f, 1.0f);
            return ImGui::ColorConvertFloat4ToU32(c);
            };

        ImVec2 lp = pos;
        if (show_lbl && lbl && *lbl)
            pos.y += ImGui::CalcTextSize(lbl).y + 4.0f;

        ImRect bb(pos, pos + sz);
        ImGui::ItemSize(bb, st.FramePadding.y);
        if (!ImGui::ItemAdd(bb, id)) return false;

        ImVec2 csz(sz.y, sz.y);
        ImRect cbb(bb.Max - csz, bb.Max);
        bool cho = false, chh = false, chp = false;

        if (hk->KeyName()[0] != '\0') {
            ImGuiID cid = win->GetID((std::string(hk->name) + "_clr").c_str());
            if (ImGui::ItemAdd(cbb, cid)) {
                chp = ImGui::ButtonBehavior(cbb, cid, &cho, &chh);
                if (chp) {
                    hk->key = 0;
                    hk->waiting = false;
                    hk->enabled = false;
                    ImGui::ClearActiveID();
                }
                ImU32 ccol = cho ? IM_COL32(220, 80, 80, 255) : IM_COL32(160, 160, 160, 255);
                ImVec2 xpos = cbb.Min + ImVec2(
                    (csz.x - ImGui::CalcTextSize("x").x) * 0.5f,
                    (csz.y - ImGui::CalcTextSize("x").y) * 0.5f);
                ImGui::GetForegroundDrawList()->AddText(xpos, ccol, "x");
            }
        }

        bool hov, held;
        bool pressed = ImGui::ButtonBehavior(bb, id, &hov, &held, flags);

        if (pressed) { ImGui::SetActiveID(id, win); hk->waiting = true; }
        if (hk->waiting && hk->Capture()) hk->waiting = false;

        if (ImGui::IsMouseReleased(ImGuiMouseButton_Right) && hov) {
            ImGui::OpenPopup((std::string(hk->name) + "_menu").c_str());
        }

        ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
        ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
        ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);
        ImU32 ctxt = ImGui::GetColorU32(ImGuiCol_Text);
        ImU32 clab = ImGui::GetColorU32(ImGuiCol_Text);

        if (hov) {
            ctop = L(ctop, 1.15f); cbot = L(cbot, 1.15f); cbor = L(cbor, 1.15f);
            ctxt = L(ctxt, 1.75f); clab = L(clab, 1.75f);
        }

        if (show_lbl && lbl && *lbl)
            win->DrawList->AddText(lp, clab, lbl);

        win->DrawList->AddRectFilledMultiColor(bb.Min, bb.Max, ctop, ctop, cbot, cbot);
        win->DrawList->AddRect(bb.Min, bb.Max, cbor, st.FrameRounding);

        std::string txt = hk->waiting ? "" : hk->KeyName();
        ImVec2 tsz = ImGui::CalcTextSize(txt.c_str());
        ImVec2 tpos = bb.Min + ImVec2(st.FramePadding.x + 3.0f, (sz.y - tsz.y) * 0.5f);
        win->DrawList->AddText(tpos, ctxt, txt.c_str());

        ImGui::SetNextWindowSize(ImVec2(72, 73));
        ImGui::PushStyleColor(ImGuiCol_Border, IM_COL32(0x1B, 0x1B, 0x23, 255));
        ImGui::PushStyleColor(ImGuiCol_PopupBg, IM_COL32(0x27, 0x27, 0x2F, 255));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(5, 5));
        if (ImGui::BeginPopup((std::string(hk->name) + "_menu").c_str()))
        {
            ImVec2 win_pos = ImGui::GetWindowPos();
            ImVec2 win_size = ImGui::GetWindowSize();
            ImDrawList* dl = ImGui::GetWindowDrawList();

            dl->AddRect(win_pos + ImVec2(1, 1), win_pos + win_size - ImVec2(1, 1), IM_COL32(0x38, 0x38, 0x42, 255), 0.0f, 0, 1.0f);

            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(2, 2));
            ImGui::PushStyleColor(ImGuiCol_ChildBg, IM_COL32(0x17, 0x17, 0x1E, 255));
            if (ImGui::BeginChild("popup_child", ImVec2(0, 0), false))
            {
                ImVec2 cpos = ImGui::GetWindowPos();
                ImVec2 csize = ImGui::GetWindowSize();

                dl->AddRect(cpos, cpos + csize, IM_COL32(0x38, 0x38, 0x42, 255), 0.0f, 0, 1.0f);

                dl->AddRectFilled(ImVec2(cpos.x + 2, cpos.y + 2),
                    ImVec2(cpos.x + csize.x - 2, cpos.y + 4),
                    ImColor(Style::Accent));

                ImGui::SetCursorPosY(ImGui::GetCursorPosY() + 10);

                float side_margin = 6.0f;
                float avail_width = ImGui::GetContentRegionAvail().x;
                float item_width = avail_width - (side_margin * 2.0f);

                ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2(6, 2));
                ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(2, 4));

                ImGui::SetCursorPosX(ImGui::GetCursorPosX() + side_margin);
                if (ImGui::CustomSelectable("Toggle", hk->type == Hotkey::TOGGLE, 0, ImVec2(item_width, 0)))
                    hk->type = Hotkey::TOGGLE;

                ImGui::SetCursorPosX(ImGui::GetCursorPosX() + side_margin);
                if (ImGui::CustomSelectable("Hold", hk->type == Hotkey::HOLD, 0, ImVec2(item_width, 0)))
                    hk->type = Hotkey::HOLD;

                ImGui::SetCursorPosX(ImGui::GetCursorPosX() + side_margin);
                if (ImGui::CustomSelectable("Always", hk->type == Hotkey::ALWAYS, 0, ImVec2(item_width, 0)))
                    hk->type = Hotkey::ALWAYS;

                ImGui::PopStyleVar(2);

            }
            ImGui::EndChild();
            ImGui::PopStyleColor();
            ImGui::PopStyleVar();
            ImGui::EndPopup();
        }
        ImGui::PopStyleVar();
        ImGui::PopStyleColor(2);


        ImGui::Dummy(ImVec2(0.0f, 20.0f));
        return pressed;
    }

    int ConfirmPopup(const char* id, const char* text, const char* yes_label, const char* no_label, ImVec2)
    {
        int result = 0;

        if (ImGui::IsPopupOpen(id)) {
            ImGuiViewport* vp = ImGui::GetMainViewport();
            ImGui::SetNextWindowPos(vp->GetCenter(), ImGuiCond_Always, ImVec2(0.5f, 0.5f));
            ImGui::SetNextWindowSize(ImVec2(330, 100), ImGuiCond_Always);
        }

        ImGui::PushStyleColor(ImGuiCol_Border, IM_COL32(0x1B, 0x1B, 0x23, 255));
        ImGui::PushStyleColor(ImGuiCol_PopupBg, IM_COL32(0x27, 0x27, 0x2F, 255));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(6, 6));

        if (ImGui::BeginPopup(id))
        {
            ImDrawList* dl = ImGui::GetWindowDrawList();
            ImVec2 wp = ImGui::GetWindowPos();
            ImVec2 ws = ImGui::GetWindowSize();

            dl->AddRect(wp + ImVec2(1, 1), wp + ws - ImVec2(1, 1), IM_COL32(0x38, 0x38, 0x42, 255));

            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(2, 2));
            ImGui::PushStyleColor(ImGuiCol_ChildBg, IM_COL32(0x17, 0x17, 0x1E, 255));
            if (ImGui::BeginChild("confirm_child", ImVec2(0, 0), false))
            {
                ImVec2 cp = ImGui::GetWindowPos();
                ImVec2 cs = ImGui::GetWindowSize();

                dl->AddRect(cp, cp + cs, IM_COL32(0x38, 0x38, 0x42, 255));
                dl->AddRectFilled(ImVec2(cp.x + 2, cp.y + 2),
                    ImVec2(cp.x + cs.x - 2, cp.y + 4),
                    ImColor(Style::Accent));

                ImGui::SetCursorPosY(ImGui::GetCursorPosY() + 30);
                ImVec2 ts = ImGui::CalcTextSize(text);
                ImGui::SetCursorPosX((cs.x - ts.x) * 0.5f);
                ImGui::TextUnformatted(text);

                ImGui::Dummy(ImVec2(0, 6));

                float bw = 74.0f, bh = ImGui::GetFrameHeight() + 6.f, gap = 2.0f;
                float total = bw * 2.0f + gap;
                ImGui::SetCursorPosX(cs.x - total - 12.0f);

                if (ImGui::Button(yes_label, ImVec2(bw, bh))) { result = 1; ImGui::CloseCurrentPopup(); }
                ImGui::SameLine();
                if (ImGui::Button(no_label, ImVec2(bw, bh))) { result = -1; ImGui::CloseCurrentPopup(); }
            }
            ImGui::EndChild();
            ImGui::PopStyleColor();
            ImGui::PopStyleVar();

            ImGui::EndPopup();
        }

        ImGui::PopStyleVar();
        ImGui::PopStyleColor(2);
        return result;
    }

    bool BeginFrameWindow(const char* title, const ImVec2& min_size)
    {
        ImGui::SetNextWindowSizeConstraints(min_size, ImVec2(FLT_MAX, FLT_MAX));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);
        if (!ImGui::Begin(title, nullptr, ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize))
        {
            ImGui::PopStyleVar(); ImGui::End(); return false;
        }
        ImGui::PopStyleVar();

        ImVec2 win_pos = ImGui::GetWindowPos();
        ImVec2 win_sz = ImGui::GetWindowSize();
        ImDrawList* dl = ImGui::GetWindowDrawList();

        Widgets::DrawBorder(dl, win_pos, win_sz, ImColor(Style::Border));
        Widgets::DrawBorder(dl, win_pos, win_sz, ImColor(Style::BorderInner), 2);

        ImGui::SetCursorPos(ImVec2(8, 8));
        ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
        ImGui::BeginChild("Main", ImVec2(win_sz.x - 16, win_sz.y - 16), true);
        {
            ImVec2 cp = ImGui::GetWindowPos();
            ImVec2 cs = ImGui::GetWindowSize();
            ImDrawList* cdl = ImGui::GetWindowDrawList();
            ImVec2 a = ImVec2(cp.x + 2.5f, cp.y + 2.5f);
            ImVec2 b = ImVec2(cp.x + cs.x - 2.0f, cp.y + 4.0f);
            cdl->AddRectFilled(a, b, ImColor(Style::Accent));

            ImGui::SetCursorPos(ImVec2(12, 12));
            ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::InnerChildBg);
            ImGui::BeginChild("Inner", ImVec2(cs.x - 24, cs.y - 24), true);
        }
        return true;
    }

    void EndFrameWindow()
    {
        ImGui::EndChild();
        ImGui::PopStyleColor();
        ImGui::EndChild();
        ImGui::PopStyleColor();
        ImGui::End();
    }

    Console ConsoleInstance;

    void Console::Clear() {
        buf.clear();
        line_offsets.clear();
        line_colors.clear();
        line_offsets.push_back(0);
    }

    void Console::Add(ImU32 color, Filter type, const char* fmt, ...) {
        int old_size = buf.size();

        va_list args;
        va_start(args, fmt);
        buf.appendfv(fmt, args);
        va_end(args);

        if (buf.size() == old_size || buf[buf.size() - 1] != '\n')
            buf.append("\n");

        if (line_offsets.empty())
            line_offsets.push_back(0);

        line_colors.push_back(color);
        line_types.push_back(type);
        line_offsets.push_back(buf.size());
    }

    void Console::Draw(const char* id, const ImVec2& size) {
        ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
        ImGui::PushStyleColor(ImGuiCol_Border, IM_COL32(18, 18, 26, 255));
        ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(0, 2));

        ImGuiWindowFlags flags = autoscroll
            ? ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse
            : 0;

        ImGui::BeginChild(id, size, true, flags);

        int line_count = line_colors.size();
        for (int i = 0; i < line_count; i++) {
            if (current_filter != ALL && line_types[i] != current_filter)
                continue;

            const char* line_start = buf.begin() + line_offsets[i];
            const char* line_end = (i + 1 < line_offsets.size())
                ? buf.begin() + line_offsets[i + 1] - 1
                : buf.end();

            ImGui::PushStyleColor(ImGuiCol_Text, line_colors[i]);
            ImGui::TextUnformatted(line_start, line_end);
            ImGui::PopStyleColor();
        }

        if (autoscroll)
            ImGui::SetScrollHereY(1.0f);

        ImGui::EndChild();

        ImVec2 min = ImGui::GetItemRectMin();
        ImVec2 max = ImGui::GetItemRectMax();
        ImGui::GetWindowDrawList()->AddRect(min + ImVec2(1, 1), max - ImVec2(1, 1), ImColor(Style::BorderInner));

        ImGui::PopStyleVar();
        ImGui::PopStyleColor(2);
    }

    static inline ImU32 ColSuccess() { return IM_COL32(120, 220, 120, 255); }
    static inline ImU32 ColWarn() { return IM_COL32(255, 200, 100, 255); }
    static inline ImU32 ColInfo() { return IM_COL32(120, 170, 255, 255); }
    static inline ImU32 ColDebug() { return IM_COL32(180, 180, 190, 255); }

    void LogSuccess(const char* fmt, ...) {
        va_list args; va_start(args, fmt);
        char tmp[1024]; vsnprintf(tmp, sizeof(tmp), fmt, args);
        va_end(args);
        ConsoleInstance.Add(ColSuccess(), Console::SUCCESS, "[SUCCESS] %s", tmp);
    }

    void LogWarn(const char* fmt, ...) {
        va_list args; va_start(args, fmt);
        char tmp[1024]; vsnprintf(tmp, sizeof(tmp), fmt, args);
        va_end(args);
        ConsoleInstance.Add(ColWarn(), Console::WARN, "[WARN] %s", tmp);
    }

    void LogInfo(const char* fmt, ...) {
        va_list args; va_start(args, fmt);
        char tmp[1024]; vsnprintf(tmp, sizeof(tmp), fmt, args);
        va_end(args);
        ConsoleInstance.Add(ColInfo(), Console::INFO, "[INFO] %s", tmp);
    }

    void LogDebug(const char* fmt, ...) {
        va_list args; va_start(args, fmt);
        char tmp[1024]; vsnprintf(tmp, sizeof(tmp), fmt, args);
        va_end(args);
        ConsoleInstance.Add(ColDebug(), Console::DEBUG, "[DEBUG] %s", tmp);
    }

    bool AnimatedTextbox(const char* id, const char* label, char* buf, size_t buf_size, bool show_label)
    {
        ImGuiWindow* window = ImGui::GetCurrentWindow();
        if (window->SkipItems) return false;

        ImGuiContext& g = *GImGui;
        const ImGuiStyle& style = g.Style;
        const ImGuiID widget_id = window->GetID(id);

        float fw = ImGui::GetContentRegionAvail().x - 68.0f;
        float h = ImGui::GetFrameHeight() * 1.1f;
        ImVec2 sz(fw, h);

        ImVec2 pos = window->DC.CursorPos;
        pos.x += 20.0f;
        pos.y -= 1.0f;

        ImVec2 label_pos = pos;
        if (show_label && label && *label)
            pos.y += ImGui::CalcTextSize(label).y + 4.0f;

        ImRect bb(pos, pos + sz);
        ImGui::ItemSize(bb, style.FramePadding.y);
        if (!ImGui::ItemAdd(bb, widget_id)) return false;

        bool hovered, held;
        bool pressed = ImGui::ButtonBehavior(bb, widget_id, &hovered, &held);

        static std::unordered_map<ImGuiID, float> animation_times;
        static std::unordered_map<ImGuiID, bool> was_active;
        
        float& anim_time = animation_times[widget_id];
        bool& was_active_state = was_active[widget_id];
        
        bool is_active = ImGui::IsItemActive();
        if (is_active && !was_active_state) {
            anim_time = 0.0f;
        }
        was_active_state = is_active;

        if (is_active) {
            anim_time += ImGui::GetIO().DeltaTime * 8.0f;
        } else {
            anim_time -= ImGui::GetIO().DeltaTime * 4.0f;
        }
        anim_time = ImClamp(anim_time, 0.0f, 1.0f);

        auto L = [](ImU32 col, float f) {
            ImVec4 c = ImGui::ColorConvertU32ToFloat4(col);
            c.x = ImMin(c.x * f, 1.0f);
            c.y = ImMin(c.y * f, 1.0f);
            c.z = ImMin(c.z * f, 1.0f);
            return ImGui::ColorConvertFloat4ToU32(c);
        };

        ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
        ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
        ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);
        ImU32 ctxt = ImGui::GetColorU32(ImGuiCol_Text);
        ImU32 clab = ImGui::GetColorU32(ImGuiCol_Text);

        if (hovered) {
            ctop = L(ctop, 1.15f); cbot = L(cbot, 1.15f); cbor = L(cbor, 1.15f);
            ctxt = L(ctxt, 1.75f); clab = L(clab, 1.75f);
        }

        ImVec4 accent_color = Style::Accent;
        float glow_intensity = anim_time * 0.3f;
        ImU32 glow_color = IM_COL32(
            (int)(accent_color.x * 255 * glow_intensity),
            (int)(accent_color.y * 255 * glow_intensity),
            (int)(accent_color.z * 255 * glow_intensity),
            255
        );

        window->DrawList->AddRectFilledMultiColor(bb.Min, bb.Max, ctop, ctop, cbot, cbot);
        window->DrawList->AddRect(bb.Min, bb.Max, cbor, style.FrameRounding);
        
        if (anim_time > 0.0f) {
            window->DrawList->AddRect(bb.Min, bb.Max, glow_color, style.FrameRounding, 0, 2.0f);
        }

        ImGui::SetCursorScreenPos(pos);
        ImGui::SetNextItemWidth(fw);
        
        bool changed = ImGui::InputText(("##" + std::string(id)).c_str(), buf, buf_size);

        if (show_label && label && *label) {
            ImU32 lbl_col = ImGui::GetColorU32(ImGuiCol_Text);
            if (hovered) {
                ImVec4 c = ImGui::ColorConvertU32ToFloat4(lbl_col);
                c.x = ImMin(c.x * 1.5f, 1.0f);
                c.y = ImMin(c.y * 1.5f, 1.0f);
                c.z = ImMin(c.z * 1.5f, 1.0f);
                lbl_col = ImGui::ColorConvertFloat4ToU32(c);
            }
            window->DrawList->AddText(label_pos, lbl_col, label);
        }

        ImGui::Dummy(ImVec2(0.0f, 2.0f));
        return changed;
    }

    bool AnimatedCombo(const char* id, const char* label, const std::vector<const char*>& items, int* current_item, bool show_label)
    {
        ImGuiWindow* window = ImGui::GetCurrentWindow();
        if (window->SkipItems) return false;

        ImGuiContext& g = *GImGui;
        const ImGuiStyle& style = g.Style;
        const ImGuiID widget_id = window->GetID(id);

        const char* preview = (*current_item >= 0 && *current_item < items.size()) ? items[*current_item] : "";

        float fw = ImGui::GetContentRegionAvail().x - 68.0f;
        float h = ImGui::GetFrameHeight() * 1.1f;
        ImVec2 sz(fw, h);

        ImVec2 pos = window->DC.CursorPos;
        pos.x += 20.0f;
        pos.y -= 1.0f;

        ImVec2 label_pos = pos;
        if (show_label && label && *label)
            pos.y += ImGui::CalcTextSize(label).y + 4.0f;

        ImRect bb(pos, pos + sz);
        ImGui::ItemSize(bb, style.FramePadding.y);
        if (!ImGui::ItemAdd(bb, widget_id)) return false;

        bool hovered, held;
        bool pressed = ImGui::ButtonBehavior(bb, widget_id, &hovered, &held);

        static std::unordered_map<ImGuiID, float> animation_times;
        static std::unordered_map<ImGuiID, bool> was_open;
        
        float& anim_time = animation_times[widget_id];
        bool& was_open_state = was_open[widget_id];
        
        bool is_open = ImGui::IsPopupOpen(("##" + std::string(id)).c_str());
        if (is_open && !was_open_state) {
            anim_time = 0.0f;
        }
        was_open_state = is_open;

        if (is_open) {
            anim_time += ImGui::GetIO().DeltaTime * 6.0f;
        } else {
            anim_time -= ImGui::GetIO().DeltaTime * 3.0f;
        }
        anim_time = ImClamp(anim_time, 0.0f, 1.0f);

        auto L = [](ImU32 col, float f) {
            ImVec4 c = ImGui::ColorConvertU32ToFloat4(col);
            c.x = ImMin(c.x * f, 1.0f);
            c.y = ImMin(c.y * f, 1.0f);
            c.z = ImMin(c.z * f, 1.0f);
            return ImGui::ColorConvertFloat4ToU32(c);
        };

        ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
        ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
        ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);
        ImU32 ctxt = ImGui::GetColorU32(ImGuiCol_Text);
        ImU32 clab = ImGui::GetColorU32(ImGuiCol_Text);

        if (hovered) {
            ctop = L(ctop, 1.15f); cbot = L(cbot, 1.15f); cbor = L(cbor, 1.15f);
            ctxt = L(ctxt, 1.75f); clab = L(clab, 1.75f);
        }

        ImVec4 accent_color = Style::Accent;
        float pulse_intensity = (sinf(ImGui::GetTime() * 4.0f) + 1.0f) * 0.5f * anim_time * 0.2f;
        ImU32 pulse_color = IM_COL32(
            (int)(accent_color.x * 255 * pulse_intensity),
            (int)(accent_color.y * 255 * pulse_intensity),
            (int)(accent_color.z * 255 * pulse_intensity),
            255
        );

        window->DrawList->AddRectFilledMultiColor(bb.Min, bb.Max, ctop, ctop, cbot, cbot);
        window->DrawList->AddRect(bb.Min, bb.Max, cbor, style.FrameRounding);
        
        if (anim_time > 0.0f) {
            window->DrawList->AddRect(bb.Min, bb.Max, pulse_color, style.FrameRounding, 0, 1.5f);
        }

        ImGui::SetCursorScreenPos(pos);
        ImGui::SetNextItemWidth(fw);

        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(8, 8));
        ImGui::PushStyleColor(ImGuiCol_PopupBg, IM_COL32(0, 0, 0, 0));
        ImGui::PushStyleColor(ImGuiCol_Border, IM_COL32(0, 0, 0, 0));

        bool changed = false;
        bool open = ImGui::BeginCombo(("##" + std::string(id)).c_str(), preview, ImGuiComboFlags_NoArrowButton);
        if (open) {
            ImGui::SetWindowPos(ImVec2(ImGui::GetWindowPos().x, ImGui::GetWindowPos().y + 4));

            ImVec2 wp = ImGui::GetWindowPos();
            ImVec2 ws = ImGui::GetWindowSize();
            ImDrawList* dl = ImGui::GetWindowDrawList();

            ImU32 ctop = IM_COL32(0x26, 0x26, 0x30, 255);
            ImU32 cbot = IM_COL32(0x22, 0x22, 0x29, 255);
            ImU32 cbor = IM_COL32(0x13, 0x13, 0x19, 255);

            dl->AddRectFilledMultiColor(wp, wp + ws, ctop, ctop, cbot, cbot);
            dl->AddRect(wp, wp + ws, cbor, 0.0f, 0, 3.5f);

            for (int i = 0; i < items.size(); i++) {
                bool sel = (i == *current_item);
                ImGui::SetCursorPosX(ImGui::GetCursorPosX() + 6);
                if (ImGui::Selectable(items[i], sel, 0, ImVec2(ImGui::GetContentRegionAvail().x - 6, 0))) {
                    *current_item = i;
                    changed = true;
                }
                if (sel)
                    ImGui::SetItemDefaultFocus();
            }
            ImGui::Dummy(ImVec2(0, 1.0f));

            ImGui::EndCombo();
        }

        ImGui::PopStyleColor(2);
        ImGui::PopStyleVar();

        ImVec2 tsz = ImGui::CalcTextSize(preview);
        ImVec2 tpos = bb.Min + ImVec2(style.FramePadding.x + 3.0f, (sz.y - tsz.y) * 0.5f);
        window->DrawList->AddText(tpos, ctxt, preview);

        float arr = h * 0.15f;
        ImVec2 ctr = ImVec2(bb.Max.x - h * 0.5f, bb.Min.y + h * 0.5f);
        ImU32 acol = hovered ? IM_COL32(200, 200, 200, 255) : IM_COL32(160, 160, 160, 255);
        ImU32 shadow_col = IM_COL32(0, 0, 0, 100);

        ImVec2 p1, p2, p3;
        if (open) {
            p1 = ImVec2(ctr.x - arr, ctr.y + arr * 0.8f);
            p2 = ImVec2(ctr.x + arr, ctr.y + arr * 0.8f);
            p3 = ImVec2(ctr.x, ctr.y - arr * 0.6f);
        } else {
            p1 = ImVec2(ctr.x - arr, ctr.y - arr * 0.8f);
            p2 = ImVec2(ctr.x + arr, ctr.y - arr * 0.8f);
            p3 = ImVec2(ctr.x, ctr.y + arr * 0.6f);
        }

        window->DrawList->AddTriangleFilled(p1 + ImVec2(1, 1), p2 + ImVec2(1, 1), p3 + ImVec2(1, 1), shadow_col);
        window->DrawList->AddTriangleFilled(p1, p2, p3, acol);

        if (show_label && label && *label) {
            ImU32 lbl_col = ImGui::GetColorU32(ImGuiCol_Text);
            if (hovered) {
                ImVec4 c = ImGui::ColorConvertU32ToFloat4(lbl_col);
                c.x = ImMin(c.x * 1.5f, 1.0f);
                c.y = ImMin(c.y * 1.5f, 1.0f);
                c.z = ImMin(c.z * 1.5f, 1.0f);
                lbl_col = ImGui::ColorConvertFloat4ToU32(c);
            }
            window->DrawList->AddText(label_pos, lbl_col, label);
        }

        ImGui::Dummy(ImVec2(0.0f, 2.0f));
        return changed;
    }
}
