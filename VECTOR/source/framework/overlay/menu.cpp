#define IMGUI_DEFINE_MATH_OPERATORS

#include <d3d11.h>
#include <tchar.h>
#include <vector>
#include <string>
#include <chrono>
#include <dwmapi.h>
#include <algorithm>

#include <source/utils/imgui/imgui.h>
#include <source/utils/imgui/backends/imgui_impl_win32.h>
#include <source/utils/imgui/backends/imgui_impl_dx11.h>
#include <source/framework/overlay/misc/style.h>
#include <source/framework/overlay/misc/widgets.h>
#include <source/utils/imgui/imgui_internal.h>
#include <source/framework/overlay/menu.hpp>
#include <source/framework/overlay/config/config.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/framework/features/functions/visuals/visuals.hpp>
#include <source/utils/data/hex/skeleton.hpp>
#include <source/utils/data/hex/box.hpp>

#include <wincodec.h>
#include <wrl/client.h>
#include <limits>


namespace {
// Only decodes the embedded image resources. No URL/file loading or code execution.
bool load_embedded_texture(ID3D11Device* device, const void* data, size_t size,
    ID3D11ShaderResourceView** result)
{
    if (!device || !data || !result || size == 0 || size > (std::numeric_limits<DWORD>::max)())
        return false;
    *result = nullptr;
    struct ComScope {
        HRESULT state = ::CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        ~ComScope() { if (SUCCEEDED(state)) ::CoUninitialize(); }
    } com;
    if (FAILED(com.state) && com.state != RPC_E_CHANGED_MODE) return false;
    using Microsoft::WRL::ComPtr;
    ComPtr<IWICImagingFactory> factory;
    if (FAILED(::CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(factory.GetAddressOf())))) return false;
    ComPtr<IWICStream> stream;
    if (FAILED(factory->CreateStream(stream.GetAddressOf())) ||
        FAILED(stream->InitializeFromMemory(
            reinterpret_cast<BYTE*>(const_cast<void*>(data)), static_cast<DWORD>(size)))) return false;
    ComPtr<IWICBitmapDecoder> decoder;
    if (FAILED(factory->CreateDecoderFromStream(stream.Get(), nullptr,
        WICDecodeMetadataCacheOnLoad, decoder.GetAddressOf()))) return false;
    ComPtr<IWICBitmapFrameDecode> frame;
    if (FAILED(decoder->GetFrame(0, frame.GetAddressOf()))) return false;
    ComPtr<IWICFormatConverter> converter;
    if (FAILED(factory->CreateFormatConverter(converter.GetAddressOf())) ||
        FAILED(converter->Initialize(frame.Get(), GUID_WICPixelFormat32bppRGBA,
            WICBitmapDitherTypeNone, nullptr, 0.0, WICBitmapPaletteTypeCustom))) return false;
    UINT width = 0, height = 0;
    if (FAILED(converter->GetSize(&width, &height)) || width == 0 || height == 0 ||
        width > 4096 || height > 4096) return false;
    const UINT pitch = width * 4, byte_count = pitch * height;
    std::vector<BYTE> pixels(byte_count);
    if (FAILED(converter->CopyPixels(nullptr, pitch, byte_count, pixels.data()))) return false;
    D3D11_TEXTURE2D_DESC description = {};
    description.Width = width; description.Height = height;
    description.MipLevels = 1; description.ArraySize = 1;
    description.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    description.SampleDesc.Count = 1;
    description.Usage = D3D11_USAGE_DEFAULT;
    description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA initial = {};
    initial.pSysMem = pixels.data(); initial.SysMemPitch = pitch;
    ComPtr<ID3D11Texture2D> texture;
    if (FAILED(device->CreateTexture2D(&description, &initial, texture.GetAddressOf()))) return false;
    return SUCCEEDED(device->CreateShaderResourceView(texture.Get(), nullptr, result));
}
void write_lighting_rgb(uintptr_t offset, const ImVec4& color)
{
    if (!globals->lighting) return;
    const sdk::vector3_t rgb{ color.x, color.y, color.z };
    static_assert(sizeof(rgb) == sizeof(float) * 3, "Lighting RGB must occupy 12 bytes");
    g_memory->write<sdk::vector3_t>(globals->lighting->address + offset, rgb);
}
}

static ID3D11Device* g_pd3dDevice = nullptr;
static ID3D11DeviceContext* g_pd3dDeviceContext = nullptr;
static IDXGISwapChain* g_pSwapChain = nullptr;
static bool                     g_SwapChainOccluded = false;
static UINT                     g_ResizeWidth = 0, g_ResizeHeight = 0;
static ID3D11RenderTargetView* g_mainRenderTargetView = nullptr;
static bool menu_show = true;
static bool last_menu_show = false;

static bool want_load_popup = false;
static bool want_delete_popup = false;

bool CreateDeviceD3D(HWND hWnd);
void CleanupDeviceD3D();
void CreateRenderTarget();
void CleanupRenderTarget();
LRESULT WINAPI WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);

HWND roblox_window = FindWindowA(0, "Roblox");

// Streamer mode using Windows Display Affinity
void set_streamer_mode(HWND hwnd, bool enable) {
    if (enable) {
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE); // Bypass screen capture
    } else {
        SetWindowDisplayAffinity(hwnd, WDA_NONE); // Bypass off
    }
}

bool fullsc(HWND windowHandle)
{
    MONITORINFO monitorInfo = { sizeof(MONITORINFO) };
    if (GetMonitorInfo(MonitorFromWindow(windowHandle, MONITOR_DEFAULTTOPRIMARY), &monitorInfo))
    {
        RECT rect;
        if (GetWindowRect(windowHandle, &rect))
        {
            return rect.left == monitorInfo.rcMonitor.left
                && rect.right == monitorInfo.rcMonitor.right
                && rect.top == monitorInfo.rcMonitor.top
                && rect.bottom == monitorInfo.rcMonitor.bottom;
        }
    }
    return false;
}
void movewindow(HWND hw) {
    HWND target = roblox_window;
    if (!target) return;

    HWND foregroundWindow = GetForegroundWindow();

    if (!IsWindowVisible(target) || IsIconic(target))
    {
        ShowWindow(hw, SW_HIDE);
        return;
    }

    ShowWindow(hw, SW_SHOW);

    RECT rect;
    if (!GetWindowRect(target, &rect)) return;

    int rsize_x = rect.right - rect.left;
    int rsize_y = rect.bottom - rect.top;

    if (fullsc(target))
    {
        rsize_x += 16;
        rect.right -= 16;
    }
    else
    {
        rsize_y -= 39;
        rect.left += 8;
        rect.top += 31;
        rect.right -= 16;
    }

    rsize_x -= 16;

    MoveWindow(hw, rect.left, rect.top, rsize_x, rsize_y, TRUE);

    if (target == foregroundWindow)
    {
        SetWindowPos(hw, HWND_TOPMOST, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    }
}
void RenderKeybindList(const std::vector<Widgets::Hotkey*>& hotkeys)
{
    ImGuiIO& io = ImGui::GetIO();

    // Filter only enabled keybinds
    std::vector<Widgets::Hotkey*> enabled_hotkeys;
    for (auto* hk : hotkeys)
        if (hk->enabled)
            enabled_hotkeys.push_back(hk);

    if (enabled_hotkeys.empty())
        return; // nothing to render

    ImVec2 padding = ImVec2(12, 8);
    float window_width = 220.0f;
    float window_height = 30.0f + enabled_hotkeys.size() * 20.0f; // dynamic height

    // Middle-left position
    ImVec2 window_pos(10.0f, io.DisplaySize.y / 2 - window_height / 2);
    ImGui::SetNextWindowPos(window_pos, ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(window_width, window_height), ImGuiCond_Always);

    ImGui::PushStyleColor(ImGuiCol_WindowBg, Style::WindowBg);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

    ImGui::Begin("KeybindList", nullptr,
        ImGuiWindowFlags_NoTitleBar |
        ImGuiWindowFlags_NoResize |
        ImGuiWindowFlags_NoScrollbar |
        ImGuiWindowFlags_NoMove |
        ImGuiWindowFlags_NoSavedSettings |
        ImGuiWindowFlags_NoCollapse);

    ImVec2 pos = ImGui::GetWindowPos();
    ImVec2 size = ImGui::GetWindowSize();
    ImDrawList* dl = ImGui::GetWindowDrawList();

    // Outer border
    dl->AddRect(pos, pos + size, ImColor(Style::Border));
    dl->AddRect(pos + ImVec2(1, 1), pos + size - ImVec2(1, 1), ImColor(Style::BorderInner));

    // Child region
    ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
    ImGui::BeginChild("KeybindListChild", ImVec2(-1, -1), true);

    // Title
    ImGui::SetCursorPos(ImVec2(6, 6));
    ImGui::TextUnformatted("Keybinds");

    float y_offset = 26.0f; // spacing below title
    for (auto* hk : enabled_hotkeys)
    {
        ImGui::SetCursorPosY(y_offset);
        ImGui::TextUnformatted(hk->KeyName().c_str());
        y_offset += 18.0f; // spacing between keybinds
    }

    ImGui::EndChild();
    ImGui::PopStyleColor();

    ImGui::End();
    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor();
}


int overlay::c_menu::load()
{
    WNDCLASSEXW wc = { sizeof(wc), CS_CLASSDC, WndProc, 0L, 0L, GetModuleHandle(nullptr), nullptr, nullptr, nullptr, nullptr, L"VECTOR", nullptr };
    if (!::RegisterClassExW(&wc)) return 1;
    HWND hwnd = ::CreateWindowExW(WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_NOACTIVATE,
        wc.lpszClassName, L"VECTOR", WS_POPUP, 0, 0, 1920, 1080,
        nullptr, nullptr, wc.hInstance, nullptr);
    if (!hwnd) {
        ::UnregisterClassW(wc.lpszClassName, wc.hInstance);
        return 1;
    }
    if (!CreateDeviceD3D(hwnd)) {
        CleanupDeviceD3D();
        ::DestroyWindow(hwnd);
        ::UnregisterClassW(wc.lpszClassName, wc.hInstance);
        return 1;
    }
    SetLayeredWindowAttributes(hwnd, RGB(0, 0, 0), 255, LWA_ALPHA);
    MARGINS margin = { -1 };
    DwmExtendFrameIntoClientArea(hwnd, &margin);

    ::ShowWindow(hwnd, SW_SHOWDEFAULT);
    ::UpdateWindow(hwnd);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO(); (void)io;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableGamepad;

    ImGui::StyleColorsDark();

    ImGui_ImplWin32_Init(hwnd);
    ImGui_ImplDX11_Init(g_pd3dDevice, g_pd3dDeviceContext);

    ImFontConfig font_cfg;
    font_cfg.PixelSnapH = true;
    font_cfg.OversampleH = 2;
    font_cfg.OversampleV = 1;
    font_cfg.RasterizerMultiply = 1.05f;


    Style::FontRegular = io.Fonts->AddFontFromFileTTF("c:\\Windows\\Fonts\\verdana.ttf", 13.0f, &font_cfg);
    Style::FontBold = io.Fonts->AddFontFromFileTTF("c:\\Windows\\Fonts\\verdanab.ttf", 13.0f, &font_cfg);
    ID3D11Device* device = g_pd3dDevice;
    auto create_texture_once = [](ID3D11ShaderResourceView*& target, const void* data, size_t size, ID3D11Device* device) {
        if (!target) {
            load_embedded_texture(device, data, size, &target);
        }
        };

    create_texture_once(features::visuals->skeletonhead, skeletonhead, sizeof(skeletonhead), device);
    create_texture_once(features::visuals->skeletontorso, skeletontorso, sizeof(skeletontorso), device);
    create_texture_once(features::visuals->skeletonrightarm, skeletonarmright, sizeof(skeletonarmright), device);
    create_texture_once(features::visuals->skeletonleftarm, skeletonarmleft, sizeof(skeletonarmleft), device);
    create_texture_once(features::visuals->skeletonrightleg, skeletonlegright, sizeof(skeletonlegright), device);
    create_texture_once(features::visuals->skeletonleftleg, skeletonlegleft, sizeof(skeletonlegleft), device);
    create_texture_once(features::visuals->boximage, boximage, sizeof(boximage), device);


    ImGuiStyle& style = ImGui::GetStyle();

    ImVec4 clear_color = ImVec4(0.45f, 0.55f, 0.60f, 0.00f);

    bool done = false;
    while (!done)
    {
       // Sleep(1);
        MSG msg;
        while (::PeekMessage(&msg, nullptr, 0U, 0U, PM_REMOVE))
        {
            ::TranslateMessage(&msg);
            ::DispatchMessage(&msg);
            if (msg.message == WM_QUIT)
                done = true;
        }
        if (done)
            break;

        if (g_SwapChainOccluded && g_pSwapChain->Present(0, DXGI_PRESENT_TEST) == DXGI_STATUS_OCCLUDED)
        {
            ::Sleep(10);
            continue;
        }
        g_SwapChainOccluded = false;

        if (g_ResizeWidth != 0 && g_ResizeHeight != 0)
        {
            CleanupRenderTarget();
            g_pSwapChain->ResizeBuffers(0, g_ResizeWidth, g_ResizeHeight, DXGI_FORMAT_UNKNOWN, 0);
            g_ResizeWidth = g_ResizeHeight = 0;
            CreateRenderTarget();
        }

        movewindow(hwnd);

        if (GetAsyncKeyState(VK_INSERT) & 1)
            menu_show = !menu_show;


        if (GetAsyncKeyState(VK_RSHIFT) & 1)
            menu_show = !menu_show;

        // Streamer mode: Use Windows Display Affinity to exclude from capture
        static bool last_streamer_mode = false;
        if (globals->streamer_mode != last_streamer_mode) {
            set_streamer_mode(hwnd, globals->streamer_mode);
            last_streamer_mode = globals->streamer_mode;
        }

        if (menu_show != last_menu_show) {
            if (menu_show) {
                SetWindowLongA(hwnd, GWL_EXSTYLE,
                    WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED);
            }
            else {
                SetWindowLongA(hwnd, GWL_EXSTYLE,
                    WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED);
            }
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED);

            last_menu_show = menu_show;
        }

        ImGui_ImplDX11_NewFrame();
        ImGui_ImplWin32_NewFrame();
        ImGui::NewFrame();
        if (GetForegroundWindow() == roblox_window) {
            features::visuals->initialize();
        }

        Style::Setup();

        {
            ImGuiIO& io = ImGui::GetIO();

            auto now = std::chrono::system_clock::now();
            std::time_t t = std::chrono::system_clock::to_time_t(now);
            std::tm local_tm{};
            localtime_s(&local_tm, &t);

            char watermark[128];
            snprintf(watermark, sizeof(watermark),
                "VECTOR | %02d/%02d/%04d | fps: %d",
                local_tm.tm_mday, local_tm.tm_mon + 1, local_tm.tm_year + 1900,
                (int)io.Framerate);

            ImVec2 text_size = ImGui::CalcTextSize(watermark);
            ImVec2 padding = ImVec2(12, 8);
            ImVec2 win_size = text_size + padding * 2;

            ImGui::SetNextWindowPos(ImVec2(10, 10), ImGuiCond_Always);
            ImGui::SetNextWindowSize(ImVec2(200, 44), ImGuiCond_Always);

            ImGui::PushStyleColor(ImGuiCol_WindowBg, Style::WindowBg);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

            ImGui::Begin("Watermark", nullptr,
                ImGuiWindowFlags_NoTitleBar |
                ImGuiWindowFlags_NoResize |
                ImGuiWindowFlags_NoScrollbar |
                ImGuiWindowFlags_NoMove |
                ImGuiWindowFlags_NoSavedSettings |
                ImGuiWindowFlags_NoCollapse);

            ImVec2 pos = ImGui::GetWindowPos();
            ImVec2 size = ImGui::GetWindowSize();
            ImDrawList* dl = ImGui::GetWindowDrawList();

            dl->AddRect(pos, pos + size, ImColor(Style::Border));
            dl->AddRect(pos + ImVec2(1, 1), pos + size - ImVec2(1, 1), ImColor(Style::BorderInner));

            ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
            ImGui::BeginChild("WatermarkChild", ImVec2(-1, -1), true);

            ImVec2 cpos = ImGui::GetWindowPos();
            ImVec2 csize = ImGui::GetWindowSize();
            ImVec2 a = ImVec2(cpos.x + 2.5f, cpos.y + 2.5f);
            ImVec2 b = ImVec2(cpos.x + csize.x - 2.0f, cpos.y + 4.0f);
            dl->AddRectFilled(a, b, ImColor(Style::Accent));

            ImGui::SetCursorPos(ImVec2(6, 6));
            ImGui::TextUnformatted(watermark);

            ImGui::EndChild();
            ImGui::PopStyleColor();

            ImGui::End();

            ImGui::PopStyleVar(2);
            ImGui::PopStyleColor();
        }


        if (c_globals::keybind_list_enabled) {
            std::string keybind_text = "";

            // Only show actual keybinds with keys
            if (c_globals::aimlock_keybind.enabled && !c_globals::aimlock_keybind.KeyName().empty()) {
                std::string type = c_globals::aimlock_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "aimlock [" + c_globals::aimlock_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::silent_aim_keybind.enabled && !c_globals::silent_aim_keybind.KeyName().empty()) {
                std::string type = c_globals::silent_aim_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "silent aim [" + c_globals::silent_aim_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::triggerbot_keybind.enabled && !c_globals::triggerbot_keybind.KeyName().empty()) {
                std::string type = c_globals::triggerbot_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "triggerbot [" + c_globals::triggerbot_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::desync_keybind.enabled && !c_globals::desync_keybind.KeyName().empty()) {
                std::string type = c_globals::desync_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "desync [" + c_globals::desync_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::jumppower_keybind.enabled && !c_globals::jumppower_keybind.KeyName().empty()) {
                std::string type = c_globals::jumppower_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "jumppower [" + c_globals::jumppower_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::walkspeed_keybind.enabled && !c_globals::walkspeed_keybind.KeyName().empty()) {
                std::string type = c_globals::walkspeed_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "walkspeed [" + c_globals::walkspeed_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::fly_keybind.enabled && !c_globals::fly_keybind.KeyName().empty()) {
                std::string type = c_globals::fly_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "fly [" + c_globals::fly_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::spinbot_keybind.enabled && !c_globals::spinbot_keybind.KeyName().empty()) {
                std::string type = c_globals::spinbot_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "spinbot [" + c_globals::spinbot_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::bhop_keybind.enabled && !c_globals::bhop_keybind.KeyName().empty()) {
                std::string type = c_globals::bhop_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "bhop [" + c_globals::bhop_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::upside_down_keybind.enabled && !c_globals::upside_down_keybind.KeyName().empty()) {
                std::string type = c_globals::upside_down_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "upside down [" + c_globals::upside_down_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::hitbox_expand_keybind.enabled && !c_globals::hitbox_expand_keybind.KeyName().empty()) {
                std::string type = c_globals::hitbox_expand_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "hitbox expand [" + c_globals::hitbox_expand_keybind.KeyName() + "] [" + type + "]\n";
            }

            if (c_globals::animation_override_keybind.enabled && !c_globals::animation_override_keybind.KeyName().empty()) {
                std::string type = c_globals::animation_override_keybind.TypeName();
                std::transform(type.begin(), type.end(), type.begin(), ::toupper);
                keybind_text += "animation changer [" + c_globals::animation_override_keybind.KeyName() + "] [" + type + "]\n";
            }

        if (c_globals::third_person_keybind.enabled && !c_globals::third_person_keybind.KeyName().empty()) {
            std::string type = c_globals::third_person_keybind.TypeName();
            std::transform(type.begin(), type.end(), type.begin(), ::toupper);
            keybind_text += "third person [" + c_globals::third_person_keybind.KeyName() + "] [" + type + "]\n";
        }

            // Always show menu toggle
            keybind_text += "menu [INSERT] [TOGGLE]";

            // Only render if there are keybinds to show
            if (!keybind_text.empty()) {
                // Calculate text size properly for multiline text
                ImVec2 text_size = ImGui::CalcTextSize(keybind_text.c_str(), NULL, false, -1.0f);

                // Add generous padding to ensure no cutoff
                float window_width = text_size.x + 40;  // More padding
                float window_height = text_size.y + 32; // More padding for borders and accent bar

                // Calculate position based on user setting
                ImGuiIO& io = ImGui::GetIO();
                float screen_width = io.DisplaySize.x;
                float screen_height = io.DisplaySize.y;
                ImVec2 window_pos;

                switch (c_globals::keybind_list_position) {
                case 0: // Left Top
                    window_pos = ImVec2(10, 10);
                    break;
                case 1: // Left Middle
                    window_pos = ImVec2(10, (screen_height - window_height) * 0.5f);
                    break;
                case 2: // Left Bottom
                    window_pos = ImVec2(10, screen_height - window_height - 10);
                    break;
                case 3: // Right Top
                    window_pos = ImVec2(screen_width - window_width - 10, 10);
                    break;
                case 4: // Right Middle
                    window_pos = ImVec2(screen_width - window_width - 10, (screen_height - window_height) * 0.5f);
                    break;
                case 5: // Right Bottom
                    window_pos = ImVec2(screen_width - window_width - 10, screen_height - window_height - 10);
                    break;
                default:
                    window_pos = ImVec2(10, (screen_height - window_height) * 0.5f); // Default to left middle
                    break;
                }

                ImGui::SetNextWindowPos(window_pos, ImGuiCond_Always);
                ImGui::SetNextWindowSize(ImVec2(window_width, window_height), ImGuiCond_Always);

                ImGui::PushStyleColor(ImGuiCol_WindowBg, Style::WindowBg);
                ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
                ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

                ImGui::Begin("Keybinds", nullptr,
                    ImGuiWindowFlags_NoTitleBar |
                    ImGuiWindowFlags_NoResize |
                    ImGuiWindowFlags_NoScrollbar |
                    ImGuiWindowFlags_NoMove |
                    ImGuiWindowFlags_NoSavedSettings |
                    ImGuiWindowFlags_NoCollapse);

                ImVec2 pos = ImGui::GetWindowPos();
                ImVec2 size = ImGui::GetWindowSize();
                ImDrawList* dl = ImGui::GetWindowDrawList();

                dl->AddRect(pos, pos + size, ImColor(Style::Border));
                dl->AddRect(pos + ImVec2(1, 1), pos + size - ImVec2(1, 1), ImColor(Style::BorderInner));

                ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
                ImGui::BeginChild("KeybindsChild", ImVec2(-1, -1), false, ImGuiWindowFlags_NoScrollbar);

                ImVec2 cpos = ImGui::GetWindowPos();
                ImVec2 csize = ImGui::GetWindowSize();
                ImVec2 a = ImVec2(cpos.x + 2.5f, cpos.y + 2.5f);
                ImVec2 b = ImVec2(cpos.x + csize.x - 2.0f, cpos.y + 4.0f);
                dl->AddRectFilled(a, b, ImColor(Style::Accent));

                // Use proper padding that matches the window size calculation
                ImGui::SetCursorPos(ImVec2(8, 8));
                ImGui::TextUnformatted(keybind_text.c_str());

                ImGui::EndChild();
                ImGui::PopStyleColor();

                ImGui::End();

                ImGui::PopStyleVar(2);
                ImGui::PopStyleColor();
            }
        }

        if (menu_show)
        {
            ImGui::SetNextWindowSizeConstraints(ImVec2(700, 475), ImVec2(FLT_MAX, FLT_MAX));
            ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);
            ImGui::Begin("Window", nullptr, ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize);
            {
                ImGui::PopStyleVar();

                ImVec2 pos = ImGui::GetWindowPos();
                ImVec2 sz = ImGui::GetWindowSize();
                ImDrawList* dl = ImGui::GetWindowDrawList();

                Widgets::DrawBorder(dl, pos, sz, ImColor(Style::Border));
                Widgets::DrawBorder(dl, pos, sz, ImColor(Style::BorderInner), 2);

                ImVec2 ws = sz;

                ImGui::SetCursorPos(ImVec2(8, 8));
                ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
                ImGui::BeginChild("Main", ImVec2(ws.x - 16, ws.y - 16), true);
                {
                    ImVec2 cpos = ImGui::GetWindowPos();
                    ImVec2 csize = ImGui::GetWindowSize();
                    ImDrawList* cdl = ImGui::GetWindowDrawList();

                    ImVec2 a = ImVec2(cpos.x + 2.5f, cpos.y + 2.5f);
                    ImVec2 b = ImVec2(cpos.x + csize.x - 2.0f, cpos.y + 4);
                    cdl->AddRectFilled(a, b, ImColor(Style::Accent));

                    ImVec2 cs = csize;

                    ImGui::SetCursorPos(ImVec2(12, 12));
                    ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::InnerChildBg);
                    ImGui::BeginChild("Inner", ImVec2(cs.x - 24, cs.y - 24), true);
                    {
                        static int tab = 0;
                        const char* labels[6] = { "legit", "visuals", "exploits", "world", "miscellaneous", "configuration" };

                        ImVec2 ip = ImGui::GetWindowPos();
                        ImVec2 is = ImGui::GetWindowSize();
                        ImDrawList* dl = ImGui::GetWindowDrawList();

                        float left = ip.x;
                        float right = ip.x + is.x;
                        float top = ip.y;
                        float w = (right - left) / 6.0f;
                        float h = 28.0f;

                        for (int i = 0; i < 6; ++i)
                        {
                            float x0 = left + w * i;
                            float x1 = left + w * (i + 1);

                            bool hovered = false;
                            ImGui::SetCursorScreenPos(ImVec2(x0, top));
                            ImGui::InvisibleButton(labels[i], ImVec2(w, h));
                            hovered = ImGui::IsItemHovered();
                            if (ImGui::IsItemClicked()) tab = i;

                            ImU32 tcol, bcol;
                            if (i == tab)
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

                            ImVec2 a(x0, top), b(x1, top + h);
                            dl->AddRectFilledMultiColor(a, b, tcol, tcol, bcol, bcol);

                            dl->AddLine(ImVec2(x0, top), ImVec2(x0, b.y), ImGui::GetColorU32(Style::BorderInner));
                            dl->AddLine(ImVec2(x1, top), ImVec2(x1, b.y), ImGui::GetColorU32(Style::BorderInner));
                            dl->AddLine(ImVec2(x0, top), ImVec2(x1, top), ImGui::GetColorU32(Style::BorderInner));
                            dl->AddLine(ImVec2(x0, b.y), ImVec2(x1, b.y), ImGui::GetColorU32(Style::BorderInner));

                            if (i == tab)
                                dl->AddRectFilled(ImVec2(x0, b.y - 1), ImVec2(x1, b.y), ImGui::GetColorU32(Style::Accent));

                            ImVec2 ts = ImGui::CalcTextSize(labels[i]);
                            ImVec2 tc(x0 + (w - ts.x) * 0.5f, top + (h - ts.y) * 0.5f - 1.0f);
                            ImU32 text_col;
                            if (i == tab)
                                text_col = IM_COL32(255, 255, 255, 255);
                            else if (hovered)
                                text_col = IM_COL32(235, 235, 240, 255);
                            else
                                text_col = IM_COL32(200, 200, 205, 255);

                            dl->AddText(tc, text_col, labels[i]);
                        }

                        ImGui::Dummy(ImVec2(0, h - 25.0f));

                        ImVec2 avail = ImGui::GetContentRegionAvail();

                        if (tab == 0) {
                            if (Widgets::BeginTag("LeftChild", "legit", ImVec2(avail.x * 0.5f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[1] = { "aimbot" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 1, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0) // Aimbot tab
                                {

                                    Widgets::Checkbox("enabled", &c_globals::aimlock_enabled);
                                    
                                    if (globals->aimlock_enabled) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->aimlock_keybind, "aimlock key", true);

                                        Widgets::Checkbox("sticky aim", &c_globals::aimlock_sticky_aim);

                                        std::vector<const char*> targeting_modes = { "closest", "fov" };
                                        Widgets::Dropdown("target type", "target type", targeting_modes, &c_globals::aimlock_targeting_mode);

                                        Widgets::Checkbox("distance", &globals->aimlock_distance_limit);
                                        if (globals->aimlock_distance_limit) {
                                            ImGui::SliderFloat("max distance", &globals->aimlock_max_distance, 50.0f, 2000.0f, "%.0f studs");
                                        }

                                        Widgets::Checkbox("wallcheck", &globals->aimbot_wallcheck);



                                        if (globals->aimlock_targeting_mode == 1) {
                                            Widgets::Checkbox("show fov", &globals->aimlock_fov_visible);
                                            ImGui::SameLine();
                                            ImGui::ColorEdit4("##FOVColor", (float*)&globals->aimlock_fov_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                            ImGui::SliderFloat("fov size", &globals->aimlock_fov_size, 1.0f, 180.0f, "%.1f°");

                                            if (globals->aimlock_fov_visible) {
                                                Widgets::Checkbox("filled", &globals->aimlock_fov_filled);
                                                Widgets::Checkbox("outline", &globals->aimlock_fov_outline);
                                            }
                                        }

                                        std::vector<const char*> lock_modes = { "rotation", "mouse", "mouse input"};
                                        Widgets::Dropdown("aimtype", "aim type", lock_modes, &c_globals::aimlock_mode);


                                        Widgets::Checkbox("smoothing", &globals->aimlock_smoothing_enabled);
                                        if (globals->aimlock_smoothing_enabled) {
                                            std::vector<const char*> smoothing_types = { "Normal", "X/Y Separate" };
                                            Widgets::Dropdown("smoothing type", "smoothing type", smoothing_types, &globals->aimlock_smoothing_type);
                                            
                                            if (globals->aimlock_smoothing_type == 0) {
                                                // Normal smoothing
                                                ImGui::SliderInt("smoothness", &globals->aimlock_smoothness, 0, 100, "%d");
                                            } else {
                                                // X/Y separate smoothing
                                                ImGui::SliderFloat("smoothing x", &globals->aimlock_smoothing_x, 0.01f, 1.0f, "%.3f");
                                                ImGui::SliderFloat("smoothing y", &globals->aimlock_smoothing_y, 0.01f, 1.0f, "%.3f");
                                            }
                                        }

                                        Widgets::Checkbox("velocity prediction", &globals->aimlock_prediction);
                                        if (globals->aimlock_prediction) {
                                            ImGui::SliderFloat("prediction x", &globals->aimlock_prediction_x, 0.0f, 5.0f, "%.2f");
                                            ImGui::SliderFloat("prediction y", &globals->aimlock_prediction_y, 0.0f, 5.0f, "%.2f");
                                            ImGui::SliderFloat("prediction z", &globals->aimlock_prediction_z, 0.0f, 5.0f, "%.2f");
                                        }

                                        std::vector<const char*> target_parts = { "Head", "Torso", "HumanoidRootPart" };
                                        Widgets::Dropdown("target part", "body part", target_parts, &c_globals::aimlock_target_part);
                                        
                                        Widgets::Checkbox("shaking", &globals->aimlock_shaking_enabled);
                                        if (globals->aimlock_shaking_enabled) {
                                            ImGui::SliderFloat("shaking intensity", &globals->aimlock_shaking_intensity, 0.1f, 10.0f, "%.1f");
                                        }
                                        
                                        Widgets::Checkbox("offset", &globals->aimlock_offset_enabled);
                                        if (globals->aimlock_offset_enabled) {
                                            ImGui::SliderFloat("offset x", &globals->aimlock_offset_x, -50.0f, 50.0f, "%.1f");
                                            ImGui::SliderFloat("offset y", &globals->aimlock_offset_y, -50.0f, 50.0f, "%.1f");
                                        }

                                        Widgets::Checkbox("ground detection", &globals->aimlock_ground_detection);
                                    }
                                }
                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            ImGui::SameLine();

                            if (Widgets::BeginTag("RightChild", "other", ImVec2(avail.x * 0.5f - 6, avail.y), ImColor(Style::BorderChild)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[2] = { "silent aim", "triggerbot" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 2, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0) // Silent aim tab
                                {
                                    Widgets::Checkbox("enabled", &globals->silent_aim_enabled);

                                    if (globals->silent_aim_enabled) {

                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->silent_aim_keybind, "activation key", true);

                                        Widgets::Checkbox("sticky aim", &globals->silent_aim_sticky_aim);

                                        std::vector<const char*> targeting_modes = { "closest", "fov" };
                                        Widgets::Dropdown("target type", "target type", targeting_modes, &globals->silent_aim_targeting_mode);

                                        Widgets::Checkbox("distance", &globals->silent_aim_distance_limit);
                                        if (globals->silent_aim_distance_limit)
                                        {
                                            ImGui::SliderFloat("max distance", &globals->silent_aim_max_distance, 50.0f, 2000.0f, "%.0f studs");
                                        }

                                        Widgets::Checkbox("wallcheck", &globals->silent_aim_wallcheck);

                                        if (globals->silent_aim_targeting_mode == 1)
                                        {
                                            Widgets::Checkbox("show fov", &globals->silent_aim_fov_visible);
                                            ImGui::SameLine();
                                            ImGui::ColorEdit4("##FOVColorSilent", (float*)&globals->silent_aim_fov_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);

                                            ImGui::SliderFloat("fov size", &globals->silent_aim_fov_size, 1.0f, 180.0f, "%.1f°");

                                            if (globals->silent_aim_fov_visible)
                                            {
                                                Widgets::Checkbox("filled", &globals->silent_aim_fov_filled);
                                                Widgets::Checkbox("outline", &globals->silent_aim_fov_outline);
                                            }
                                        }

                                        std::vector<const char*> target_parts = { "Head", "Torso", "HumanoidRootPart" };
                                        Widgets::Dropdown("target part", "body part", target_parts, &globals->silent_aim_target_part);
                                    }
                                }
                                else if (subtab == 1) // Triggerbot tab
                                {
                                    Widgets::Checkbox("enabled", &globals->triggerbot_enabled);

                                    if (globals->triggerbot_enabled) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->triggerbot_keybind, "activation key", true);

                                        ImGui::SliderFloat("fov", &globals->triggerbot_fov, 1.0f, 180.0f, "%.1f°");
                                        
                                        Widgets::Checkbox("wallcheck", &globals->triggerbot_wallcheck);
                                        
                                        Widgets::Checkbox("show fov", &globals->triggerbot_fov_visible);
                                        if (globals->triggerbot_fov_visible) {
                                            ImGui::SameLine();
                                            ImGui::ColorEdit4("##FOVColorTrigger", (float*)&globals->triggerbot_fov_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                            
                                            Widgets::Checkbox("filled", &globals->triggerbot_fov_filled);
                                            Widgets::Checkbox("outline", &globals->triggerbot_fov_outline);
                                        }
                                    }
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();
                        } // aimbot
                        else if (tab == 1) // visuals Tab
                        {
                            if (Widgets::BeginTag("LeftChild", "visuals", ImVec2(avail.x * 0.5f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[2] = { "general", "extra" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 2, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0) // General
                                {
                                    Widgets::Checkbox("box", &globals->box);
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##boxcolor", (float*)&globals->box_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);

                                    Widgets::Checkbox("skeleton", &globals->skeleton_esp);
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##skeletoncolor", (float*)&globals->skeleton_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);

                                    Widgets::Checkbox("healthbar", &globals->health_bar);
         
                                    Widgets::Checkbox("chams", &globals->chams);
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##chamscolor", (float*)&globals->chams_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);

                                    Widgets::Checkbox("name esp", &globals->name_esp);
                                    Widgets::Checkbox("distance esp", &globals->distance_esp);
                                    
                                    Widgets::Checkbox("wallcheck", &globals->visual_wallcheck);
                                }
                                else if (subtab == 1) // Extra
                                {
                                    std::vector<const char*> chams_types = { "filled", "outline", "both" };
                                    Widgets::Dropdown("chams_types", "chams type", chams_types, &globals->chams_type, true);

                                    std::vector<const char*> skeleton_types = { "line", "real" };
                                    Widgets::Dropdown("skeleton_types", "skeleton type", skeleton_types, &globals->skeleton_type, true);

                                    std::vector<const char*> box_types = { "normal", "rounded", "corner", "image" };
                                    Widgets::Dropdown("box_types", "box type", box_types, &globals->box_type, true);

                                    if (globals->visual_wallcheck) {
                                        ImGui::Text("visible color"); ImGui::SameLine();
                                        ImGui::ColorEdit4("##vis_col", (float*)&globals->wallcheck_visible_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                        ImGui::Text("invisible color"); ImGui::SameLine();
                                        ImGui::ColorEdit4("##inv_col", (float*)&globals->wallcheck_hidden_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                        
                                        ImGui::Separator();
                                        ImGui::Text("Advanced Wallcheck Settings:");
                                        
                                        ImGui::SliderFloat("min part size", &globals->wallcheck_min_partsize, 0.01f, 1.0f, "%.3f");
                                        ImGui::SliderFloat("ray depth", &globals->wallcheck_ray_depth, 0.1f, 2.0f, "%.2f");
                                        ImGui::SliderFloat("cache update wait (sec)", &globals->wallcheck_cache_update_wait, 30.0f, 300.0f, "%.0f");
                                        ImGui::SliderInt("max rays per frame", &globals->wallcheck_max_rays_perframe, 1, 20);
                                        ImGui::SliderFloat("visibility distance", &globals->wallcheck_vis_distance, 100.0f, 1000.0f, "%.0f");
                                        ImGui::SliderInt("max parts checked", &globals->wallcheck_max_parts_checked, 50, 500);
                                        ImGui::SliderFloat("min volume threshold", &globals->wallcheck_min_volume_threshold, 0.001f, 0.1f, "%.4f");
                                        ImGui::SliderFloat("transparency threshold", &globals->wallcheck_transparency_threshold, 0.1f, 1.0f, "%.2f");
                                        
                                        Widgets::Checkbox("skip player parts", &globals->wallcheck_skip_player_parts);
                                        Widgets::Checkbox("skip transparent", &globals->wallcheck_skip_transparent);
                                        Widgets::Checkbox("debug mode", &globals->wallcheck_debug_mode);
                                        
                                        ImGui::Separator();
                                        ImGui::Text("Map Detection:");
                                        ImGui::Text("Current Map: %s", globals->current_map_name.c_str());
                                        ImGui::Text("Map Address: 0x%llx", globals->current_map_address);
                                        
                                        if (ImGui::Button("Force Cache Refresh")) {
                                            globals->wallcheck_force_refresh = true;
                                        }
                                        ImGui::SameLine();
                                        if (ImGui::Button("Reset Map Detection")) {
                                            globals->current_map_name = "";
                                            globals->current_map_address = 0;
                                            globals->map_changed = true;
                                        }
                                        
                                        ImGui::Separator();
                                    }
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            ImGui::SameLine();

                            // RIGHT SIDE WITH SUBTABS
                            if (Widgets::BeginTag("RightChild", "customization", ImVec2(avail.x * 0.5f - 6, avail.y), ImColor(Style::BorderChild)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int rightSubtab = 0;
                                const char* rightLabels[2] = { "general", "effects" };

                                ImVec2 rStart = ImGui::GetCursorScreenPos();
                                float rWidth = ImGui::GetWindowSize().x;

                                Widgets::SubTab(rightLabels, 2, rightSubtab, rStart, rWidth);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (rightSubtab == 0) // Box + Health
                                {
                                    if (globals->box)
                                    {
                                        ImGui::SliderFloat("box thickness", &globals->box_thickness, 0.5f, 5.0f, "%.1f");
                                        Widgets::Checkbox("box filled", &globals->box_filled);
                                        if (globals->box_filled) {
                                            ImGui::SameLine();
                                            ImGui::ColorEdit4("##boxfill", (float*)&globals->box_fill_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                            Widgets::Checkbox("box gradient", &globals->box_gradient);
                                            if (globals->box_gradient) {
                                                ImGui::SameLine();
                                                ImGui::ColorEdit4("##boxgrad", (float*)&globals->box_gradient_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                            }
                                        }
                                        Widgets::Checkbox("rainbow healthbar", &globals->box_rainbow);
                                        if (globals->box_rainbow) {
                                            ImGui::SliderFloat("rainbow healthbar speed", &globals->box_rainbow_speed, 0.1f, 5.0f, "%.1f");
                                        }
                                        Widgets::Checkbox("healthbar glow", &globals->box_glow);
                                        if (globals->box_glow) {
                                            ImGui::SliderFloat("healthbar glow size", &globals->box_glow_size, 1.0f, 8.0f, "%.1f");
                                        }
                                    }
                                    
                                    // Max distance controls
                                    Widgets::Checkbox("max distance", &globals->esp_max_distance_enabled);
                                    if (globals->esp_max_distance_enabled) {
                                        ImGui::SliderFloat("max distance", &globals->esp_max_distance, 100.0f, 5000.0f, "%.0f");
                                    }
                                    if (globals->health_bar)
                                    {
                                        Widgets::Checkbox("show health text", &globals->health_text);

                                        Widgets::Checkbox("gradient colors", &globals->health_gradient);
                                        if (globals->health_gradient) {
                                            ImGui::Text("high"); ImGui::SameLine();
                                            ImGui::ColorEdit4("##healthhigh", (float*)&globals->health_high_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                            ImGui::Text("low"); ImGui::SameLine();
                                            ImGui::ColorEdit4("##healthlow", (float*)&globals->health_low_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel);
                                        }
                                    }
                                }
                                else if (rightSubtab == 1) // Effects
                                {
                                    Widgets::Checkbox("show accessories", &globals->esp_draw_accessories);
                                    if (globals->skeleton_esp)
                                    {
                                        ImGui::SliderFloat("skeleton thickness", &globals->skeleton_thickness, 0.5f, 5.0f, "%.1f");
                                        Widgets::Checkbox("rainbow skeleton", &globals->skeleton_rainbow);
                                        if (globals->skeleton_rainbow) {
                                            ImGui::SliderFloat("rainbow skeleton speed", &globals->skeleton_rainbow_speed, 0.1f, 5.0f, "%.1f");
                                        }
                                        Widgets::Checkbox("skeleton glow", &globals->skeleton_glow);
                                        if (globals->skeleton_glow) {
                                            ImGui::SliderFloat("skeleton glow size", &globals->skeleton_glow_size, 1.0f, 6.0f, "%.1f");
                                        }

                                    }
                                    if (globals->chams)
                                    {
                                        ImGui::SliderFloat("chams transparency", &globals->chams_transparency, 0.1f, 1.0f, "%.1f");

                                        Widgets::Checkbox("rainbow chams", &globals->chams_rainbow);
                                        if (globals->chams_rainbow) {
                                            ImGui::SliderFloat("rainbow chams speed", &globals->chams_rainbow_speed, 0.1f, 5.0f, "%.1f");
                                        }

                                        Widgets::Checkbox("chams pulse", &globals->chams_pulsing);
                                        if (globals->chams_pulsing) {
                                            ImGui::SliderFloat("chams pulse speed", &globals->chams_pulse_speed, 0.5f, 5.0f, "%.1f");
                                        }

                                        Widgets::Checkbox("chams glow", &globals->chams_glow);
                                        if (globals->chams_glow) {
                                            ImGui::SliderFloat("chams glow size", &globals->chams_glow_size, 1.0f, 12.0f, "%.1f");
                                            ImGui::SliderFloat("chams outline thickness", &globals->chams_thickness, 0.5f, 5.0f, "%.1f");
                                            ImGui::Text("glow color"); ImGui::SameLine();
                                            ImGui::ColorEdit4("##chams_glow_color", (float*)&globals->chams_glow_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                        }

                                        Widgets::Checkbox("chams clipper outline", &globals->chams_clipper_outline);
                                        if (globals->chams_clipper_outline) {
                                            ImGui::SliderFloat("clipper outline width", &globals->chams_clipper_width, 0.5f, 8.0f, "%.1f");
                                            ImGui::Text("clipper outline color"); ImGui::SameLine();
                                            ImGui::ColorEdit4("##chams_clipper_color", (float*)&globals->chams_clipper_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                        }
                                    }
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();
                            }

                        else if (tab == 2) { // exploits
                            if (Widgets::BeginTag("LeftChild", "exploits", ImVec2(avail.x * 0.5f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[2] = { "general", "extra" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 2, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0)
                                {
                                    Widgets::Checkbox("spinbot", &globals->spinbot);
                                    if (globals->spinbot) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->spinbot_keybind, "spinbot key", true);
                                    }
                                    
                                    Widgets::Checkbox("bhop", &globals->bhop);
                                    if (globals->bhop) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->bhop_keybind, "bhop key", true);
                                    }
                                    
                                    Widgets::Checkbox("hitbox expand", &globals->hitbox_expand);
                                    if (globals->hitbox_expand) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->hitbox_expand_keybind, "hitbox expand key", true);
                                    }
                                    
                                    Widgets::Checkbox("upside down", &globals->upside_down);
                                    if (globals->upside_down) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->upside_down_keybind, "upside down key", true);
                                    }
                                    
                                    Widgets::Checkbox("fly", &globals->fly);
                                    if (globals->fly) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->fly_keybind, "fly key", true);
                                    }
                                    
                                    //Widgets::Checkbox("desync", &globals->desync);
                                    //if (globals->desync) {
                                    //    ImVec2 cur = ImGui::GetCursorPos();
                                    //    cur.y -= 5.0f;
                                    //    ImGui::SetCursorPos(cur);
                                    //    Widgets::DrawHotkey(&globals->desync_keybind, "desync key", true);
                                    //}
                                    
                                    Widgets::Checkbox("jumppower", &globals->jumppower);
                                    if (globals->jumppower) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->jumppower_keybind, "jumppower key", true);
                                    }
                                    
                                    Widgets::Checkbox("walkspeed", &globals->walkspeed);
                                    if (globals->walkspeed) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->walkspeed_keybind, "walkspeed key", true);
                                    }
                                }
                                if (subtab == 1) // advanced exploits
                                {
                                    Widgets::Checkbox("animation changer", &globals->animation_override);
                                    if (globals->animation_override) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->animation_override_keybind, "animation changer key", true);
                                    }

                                    ImVec2 cur2 = ImGui::GetCursorPos();
                                    cur2.y -= 5.0f;
                                    ImGui::SetCursorPos(cur2);
                                    Widgets::Dropdown("animation type", "animation type", { "part orbit", "spasim attack", "helicopter", "fentynal", "circle spin", "custom"}, & globals->animation_type);

                                    if (globals->animation_type == 5) {
                                        Widgets::AnimatedTextbox("custom_animation", "custom animation", globals->custom_animation, IM_ARRAYSIZE(globals->custom_animation));
                                    }

                                    Widgets::Checkbox("third person", &globals->third_person);
                                    if (globals->third_person) {
                                        ImVec2 cur = ImGui::GetCursorPos();
                                        cur.y -= 5.0f;
                                        ImGui::SetCursorPos(cur);
                                        Widgets::DrawHotkey(&globals->third_person_keybind, "third person key", true);
                                    }

                                    ImVec2 cur = ImGui::GetCursorPos();
                                    cur.y -= 5.0f;
                                    ImGui::SetCursorPos(cur);

                                }


                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            ImGui::SameLine();

                            if (Widgets::BeginTag("RightChild", "configuration", ImVec2(avail.x * 0.5f - 6, avail.y), ImColor(Style::BorderChild)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[2] = { "options", "misc" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 2, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0)
                                {
                                   // ImGui::SliderInt("gng", &globals->desync_value, 1, 10000000, "%d%%");
                                    ImGui::SliderFloat("spinbot speed", &globals->spinbot_speed, 1.00f, 25.0f, "%.0f");
                                    
                                    ImGui::SliderFloat("bhop speed", &globals->bhop_speed, 0.01f, 10.0f, "%.0f");
                                    ImGui::SliderFloat("bhop max speed", &globals->bhop_max_speed, 30.0f, 1250.0f, "%.0f");

                                    ImGui::SliderFloat("hitbox scale", &globals->hitbox_scale, 1.0f, 5.0f, "%.1f");
                                    ImGui::SliderFloat("fly speed", &globals->fly_speed, 1.0f, 100.0f, "%.1f");

                                    ImGui::SliderFloat("jumppower value", &globals->jumppower_value, 10.0f, 200.0f, "%.1f");
                                    ImGui::SliderFloat("walkspeed value", &globals->walkspeed_value, 5.0f, 100.0f, "%.1f");

                                    //if (globals->desync)
                                    //{

                                    //    Widgets::Checkbox("steal a brainrot test", &globals->sab_test);
                                    //}

                                    //Widgets::Checkbox("desync visualize", &globals->desync_visualizer);
                                    //if (globals->desync_visualizer)
                                    //{
                                    //    Widgets::Checkbox("outline", &globals->desync_ghost_outline);
                                    //    ImGui::SameLine();
                                    //    ImGui::ColorEdit4("##ghostcolor", (float*)&globals->desync_ghost_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel | ImGuiColorEditFlags_AlphaBar);
                                    //    if (globals->desync_ghost_outline)
                                    //    {
                                    //        
                                    //        ImGui::ColorEdit4("##ghostoutline", (float*)&globals->desync_ghost_outline_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_NoLabel | ImGuiColorEditFlags_AlphaBar);
                                    //    }
                                    //}

                                }
                                else if (subtab == 1)
                                {
                                    ImVec2 cur1 = ImGui::GetCursorPos();
                                    cur1.y -= 5.0f;
                                    ImGui::SetCursorPos(cur1);
                                    Widgets::Dropdown("spinbot", "spinbot type", {"cframe", "rotation"}, & globals->spinbot_type);
                                    
                                    ImVec2 cur2 = ImGui::GetCursorPos();
                                    cur2.y -= 5.0f;
                                    ImGui::SetCursorPos(cur2);
                                    Widgets::Dropdown("bhop", "bhop type", { "velocity", "position" }, & globals->bhop_type);

                                    ImVec2 cur3 = ImGui::GetCursorPos();
                                    cur3.y -= 5.0f;
                                    ImGui::SetCursorPos(cur3);
                                    Widgets::Dropdown("jumppower", "jumppower method", { "jumppower", "velocity", "cframe" }, &globals->jumppower_method);

                                    ImVec2 cur4 = ImGui::GetCursorPos();
                                    cur4.y -= 5.0f;
                                    ImGui::SetCursorPos(cur4);
                                    Widgets::Dropdown("walkspeed", "walkspeed method", { "walkspeed", "velocity", "cframe" }, &globals->walkspeed_method);

                                    ImVec2 cur5 = ImGui::GetCursorPos();
                                    cur5.y -= 5.0f;
                                    ImGui::SetCursorPos(cur5);
                                    if (!globals->hitbox_expand_parts.empty()) {
                                        std::vector<const char*> part_names;
                                        part_names.reserve(globals->hitbox_expand_parts.size());
                                        for (auto& s : globals->hitbox_expand_parts) {
                                            part_names.push_back(s.c_str());
                                        }

                                        Widgets::Dropdown("hitbox part",
                                            "hitbox expand part",
                                            part_names,
                                            &globals->hitbox_expand_part);
                                    }

                                }
                                ImGui::Unindent(44.0f);

                            }
                            Widgets::EndTag();
                        }

                        else if (tab == 3) // world
                        {
                            if (Widgets::BeginTag("LeftChild", "world", ImVec2(avail.x * 0.5f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered()) ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[1] = { "sliders" };
                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;
                                Widgets::SubTab(sublabels, 1, subtab, start, width);

                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0) // Sliders
                                {
                                    // Fog Start (float)
                                    if (ImGui::SliderFloat("fog start", &globals->lighting_fog_start, 0.0f, 500.0f, "%.1f"))
                                    {
                                        g_memory->write<float>(globals->lighting->address + sdk::offsets::lighting::fog_start, globals->lighting_fog_start);
                                    }

                                    // Fog End (float)  
                                    if (ImGui::SliderFloat("fog end", &globals->lighting_fog_end, 0.0f, 1000.0f, "%.1f"))
                                    {
                                        g_memory->write<float>(globals->lighting->address + sdk::offsets::lighting::fog_end, globals->lighting_fog_end);
                                    }

                                    // Brightness (float)
                                    if (ImGui::SliderFloat("brightness", &globals->lighting_brightness, 0.0f, 50.0f, "%.2f"))
                                    {
                                        g_memory->write<float>(globals->lighting->address + sdk::offsets::lighting::brightness, globals->lighting_brightness);
                                    }
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            ImGui::SameLine();
                            if (Widgets::BeginTag("RightChild", "colors", ImVec2(avail.x * 0.5f - 6, avail.y), ImColor(Style::BorderChild)))
                            {
                                if (ImGui::IsWindowHovered()) ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[1] = { "colors" };
                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;
                                Widgets::SubTab(sublabels, 1, subtab, start, width);

                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0) // Colors
                                {
                                    ImGui::Text("fog color");
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##fog_col", (float*)&globals->lighting_fog_color, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                    if (ImGui::IsItemDeactivatedAfterEdit())
                                    {
                                        write_lighting_rgb(sdk::offsets::lighting::fog_color, globals->lighting_fog_color);
                                    }

                                    // Ambient Color (Vector3)
                                    ImGui::Text("ambient color");
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##ambient_col", (float*)&globals->lighting_ambient, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                    if (ImGui::IsItemDeactivatedAfterEdit())
                                    {
                                        write_lighting_rgb(sdk::offsets::lighting::ambient, globals->lighting_ambient);
                                    }

                                    // Outdoor Ambient (Vector3)
                                    ImGui::Text("outdoor ambient");
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##outdoor_col", (float*)&globals->lighting_outdoor_ambient, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                    if (ImGui::IsItemDeactivatedAfterEdit())
                                    {
                                        write_lighting_rgb(sdk::offsets::lighting::outdoor_ambient, globals->lighting_outdoor_ambient);
                                    }

                                    // Color Shift Top (Vector3)
                                    ImGui::Text("color shift top");
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##shift_top_col", (float*)&globals->lighting_color_shift_top, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                    if (ImGui::IsItemDeactivatedAfterEdit())
                                    {
                                        write_lighting_rgb(sdk::offsets::lighting::color_shift_top, globals->lighting_color_shift_top);
                                    }

                                    // Color Shift Bottom (Vector3)
                                    ImGui::Text("color shift bottom");
                                    ImGui::SameLine();
                                    ImGui::ColorEdit4("##shift_bottom_col", (float*)&globals->lighting_color_shift_bottom, ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar);
                                    if (ImGui::IsItemDeactivatedAfterEdit())
                                    {
                                        write_lighting_rgb(sdk::offsets::lighting::color_shift_bottom, globals->lighting_color_shift_bottom);
                                    }
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();
                            }
                        else if (tab == 4) // misc
                        {
                            if (Widgets::BeginTag("LeftChild", "miscellaneous", ImVec2(avail.x * 1.0f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                static int subtab = 0;
                                const char* sublabels[2] = { "general", "extra" };

                                ImVec2 start = ImGui::GetCursorScreenPos();
                                float width = ImGui::GetWindowSize().x;

                                Widgets::SubTab(sublabels, 2, subtab, start, width);
                                ImGui::Dummy(ImVec2(0, 6));
                                ImGui::Indent(44.0f);

                                if (subtab == 0)
                                {
                                    Widgets::Checkbox("skip local player", &globals->local_player_check);
                                    Widgets::Checkbox("skip team", &globals->team_check);
                                    Widgets::Checkbox("performance mode", &globals->performance_mode);
                                    Widgets::Checkbox("streamer mode", &globals->streamer_mode);
                                    Widgets::Checkbox("player list", &globals->player_list_enabled);
                                }
                                else if (subtab == 1)
                                {
                                    Widgets::Checkbox("keybind list", &globals->keybind_list_enabled);

                                    ImGui::Spacing();

                                    const char* position_items[] = {
                                        "left top",
                                        "left middle",
                                        "left bottom",
                                        "right top",
                                        "right middle",
                                        "right bottom"
                                    };
                                    if (globals->keybind_list_enabled) {
                                        std::vector<const char*> positions(position_items, position_items + 6);
                                        Widgets::Dropdown("keybind_position", "position", positions, &c_globals::keybind_list_position, true);
                                    }

                                    if (globals->wallcheck)
                                    {
                                        ImGui::SliderInt("wallcheck check interval (seconds)", &globals->wallcheck_interval, 1, 60, "%d%%");
                                    }
                                }
                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                        }

                        else if (tab == 5) { // configs
                            static int selected_profile = 0;
                            static char cfg_name[65] = "";
                            static bool want_delete_popup = false;
                            
                            // Get available configs
                            auto available_configs = config::config_manager->get_available_configs();
                            
                            if (Widgets::BeginTag("LeftChild", "Profiles", ImVec2(avail.x * 0.5f - 6, avail.y)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                ImGui::Dummy(ImVec2(0, 16));
                                ImGui::Indent(20.0f);

                                ImVec2 list_sz = ImVec2(ImGui::GetContentRegionAvail().x - 20.0f,
                                    ImGui::GetContentRegionAvail().y - 20.0f);

                                if (ImGui::BeginListBox("##profiles_list", list_sz))
                                {
                                    ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(0, 4));
                                    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2(6, 4));

                                    ImGui::SetCursorPosY(ImGui::GetCursorPosY() + 2.0f);

                                    for (int i = 0; i < available_configs.size(); i++)
                                    {
                                        const bool is_selected = (selected_profile == i);
                                        if (ImGui::CustomSelectable2(available_configs[i].c_str(), is_selected, 0, ImVec2(0, 0)))
                                        {
                                            selected_profile = i;
                                            strncpy_s(cfg_name, available_configs[i].c_str(), sizeof(cfg_name) - 1);
                                        }

                                        if (is_selected)
                                            ImGui::SetItemDefaultFocus();
                                    }

                                    ImGui::PopStyleVar(2);
                                    ImGui::EndListBox();
                                }

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            ImGui::SameLine();

                            if (Widgets::BeginTag("RightChild", "Configurations", ImVec2(avail.x * 0.5f - 6, avail.y), ImColor(Style::BorderChild)))
                            {
                                if (ImGui::IsWindowHovered())
                                    ImGui::GetCurrentWindow()->Flags |= ImGuiWindowFlags_NoMove;

                                ImGui::Dummy(ImVec2(0, 16));
                                ImGui::Indent(44.0f);

                                float avail_w = ImGui::GetContentRegionAvail().x;
                                float btn_w = avail_w - 68.0f;
                                float btn_h = ImGui::GetFrameHeight() * 1.1f;

                                ImVec2 base = ImGui::GetCursorPos();
                                base.x += 20.0f;

                                ImGui::SetCursorPos(base);
                                ImGui::SetNextItemWidth(btn_w);
                                ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2(6, 6));
                                ImGui::InputText("##cfg_name", cfg_name, IM_ARRAYSIZE(cfg_name));
                                ImGui::PopStyleVar();

                                // Show auto-load status
                                ImGui::Dummy(ImVec2(0, 4));
                                ImGui::SetCursorPosX(base.x);
                                std::string current_auto_load = config::config_manager->get_current_config();
                                if (current_auto_load.empty())
                                {
                                    ImGui::TextColored(ImVec4(0.7f, 0.7f, 0.7f, 1.0f), "Auto-load: Disabled");
                                }
                                else
                                {
                                    ImGui::TextColored(ImVec4(0.0f, 1.0f, 0.0f, 1.0f), "Auto-load: %s", current_auto_load.c_str());
                                }

                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::SetCursorPosX(base.x);
                                if (ImGui::Button("Save", ImVec2(btn_w, btn_h))) 
                                {
                                    if (strlen(cfg_name) > 0)
                                    {
                                        config::config_manager->save_config(cfg_name);
                                    }
                                }
                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::SetCursorPosX(base.x);
                                if (ImGui::Button("Load", ImVec2(btn_w, btn_h))) 
                                {
                                    if (strlen(cfg_name) > 0)
                                    {
                                        config::config_manager->load_config(cfg_name);
                                    }
                                }
                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::SetCursorPosX(base.x);
                                if (ImGui::Button("Delete", ImVec2(btn_w, btn_h))) 
                                {
                                    if (strlen(cfg_name) > 0)
                                    {
                                        want_delete_popup = true;
                                    }
                                }
                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::SetCursorPosX(base.x);
                                if (ImGui::Button("Set Auto-Load", ImVec2(btn_w, btn_h))) 
                                {
                                    if (strlen(cfg_name) > 0)
                                    {
                                        config::config_manager->save_last_config_name(cfg_name);
                                        console->print(c_console::log_level::info, ("Auto-load set to: " + std::string(cfg_name)).c_str());
                                    }
                                }
                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::SetCursorPosX(base.x);
                                if (ImGui::Button("Disable Auto-Load", ImVec2(btn_w, btn_h))) 
                                {
                                    config::config_manager->save_last_config_name("");
                                    console->print(c_console::log_level::info, "Auto-load disabled");
                                }
                                ImGui::Dummy(ImVec2(0, 8));

                                ImGui::Unindent(44.0f);
                            }
                            Widgets::EndTag();

                            // Delete confirmation popup
                            if (want_delete_popup)
                            {
                                ImGui::OpenPopup("Delete Config");
                                want_delete_popup = false;
                            }

                            if (ImGui::BeginPopupModal("Delete Config", NULL, ImGuiWindowFlags_AlwaysAutoResize))
                            {
                                ImGui::Text("Are you sure you want to delete '%s'?", cfg_name);
                                ImGui::Separator();

                                if (ImGui::Button("Yes", ImVec2(120, 0)))
                                {
                                    config::config_manager->delete_config(cfg_name);
                                    selected_profile = -1; // Refresh list
                                    ImGui::CloseCurrentPopup();
                                }
                                ImGui::SetItemDefaultFocus();
                                ImGui::SameLine();
                                if (ImGui::Button("No", ImVec2(120, 0)))
                                {
                                    ImGui::CloseCurrentPopup();
                                }
                                ImGui::EndPopup();
                            }

                        }



                        Widgets::RenderTags();


                    }
                    ImGui::EndChild();
                    ImGui::PopStyleColor();
                }
                ImGui::EndChild();
                ImGui::PopStyleColor();
            }
            ImGui::End();

            if (Widgets::BeginFrameWindow("console", ImVec2(700, 475)))
            {
                ImVec2 avail = ImGui::GetContentRegionAvail();
                float half = avail.x * 0.5f;
                float row_h = ImGui::GetFrameHeightWithSpacing() + 16.f;

                ImGui::BeginChild("LeftChild", ImVec2(half, row_h), false, ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar);
                {
                    ImGui::Indent(8.0f);
                    if (ImGui::Button("Clear"))
                        Widgets::ConsoleInstance.Clear();

                    ImGui::SetCursorPosX(ImGui::GetCursorPosX() + 2.f);
                    ImGui::SetCursorPosY(ImGui::GetCursorPosY() + 4.f);

                    Widgets::Checkbox("Auto-scroll", &Widgets::ConsoleInstance.autoscroll);
                    ImGui::Unindent(8.0f);
                }
                ImGui::EndChild();

                ImGui::SameLine();

                ImGui::BeginChild("RightChild", ImVec2(half, row_h), false, ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar);
                {
                    static int filter_selected = (int)Widgets::ConsoleInstance.current_filter;
                    static std::vector<const char*> filters = {
                        "All",
                        "Success",
                        "Warn",
                        "Info",
                        "Debug"
                    };

                    if (Widgets::Dropdown("FilterDropdown", "Filter", filters, &filter_selected)) {
                        Widgets::ConsoleInstance.current_filter = (Widgets::Console::Filter)filter_selected;
                    }
                }
                ImGui::EndChild();

                ImGui::PushStyleColor(ImGuiCol_Separator, IM_COL32(32, 32, 38, 255));
                ImGui::Separator();
                ImGui::PopStyleColor();

                Widgets::ConsoleInstance.Draw("Console", ImVec2(-1, 350));

                if (ImGui::Button("Print success")) Widgets::LogSuccess("Success log");
                ImGui::SameLine();
                if (ImGui::Button("Print warn")) Widgets::LogWarn("Warn log");
                ImGui::SameLine();
                if (ImGui::Button("Print info")) Widgets::LogInfo("Info log");
                ImGui::SameLine();
                if (ImGui::Button("Print debug")) Widgets::LogDebug("Debug log");

                Widgets::EndFrameWindow();
            }

            if (want_load_popup) { ImGui::OpenPopup("confirm_load");   want_load_popup = false; }
            if (want_delete_popup) { ImGui::OpenPopup("confirm_delete"); want_delete_popup = false; }

            int res_load = Widgets::ConfirmPopup("confirm_load", "Are you sure you want to load the selected profile?");
            if (res_load == 1) {}

            int res_delete = Widgets::ConfirmPopup("confirm_delete", "Are you sure you want to delete the selected profile?");
            if (res_delete == 1) {}
        }

        // Player List Window
        if (globals->player_list_enabled && menu_show) {
            ImGui::SetNextWindowSize(ImVec2(400, 300), ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowPos(ImVec2(720, 50), ImGuiCond_FirstUseEver);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);
            ImGui::Begin("Player List", nullptr, ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize);
            {
                ImGui::PopStyleVar();

                ImVec2 pos = ImGui::GetWindowPos();
                ImVec2 sz = ImGui::GetWindowSize();
                ImDrawList* dl = ImGui::GetWindowDrawList();

                Widgets::DrawBorder(dl, pos, sz, ImColor(Style::Border));
                Widgets::DrawBorder(dl, pos, sz, ImColor(Style::BorderInner), 2);

                ImVec2 ws = sz;

                ImGui::SetCursorPos(ImVec2(8, 8));
                ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
                ImGui::BeginChild("PlayerListMain", ImVec2(ws.x - 16, ws.y - 16), true);
                {
                    ImVec2 cpos = ImGui::GetWindowPos();
                    ImVec2 csize = ImGui::GetWindowSize();

                    dl->AddRectFilled(ImVec2(cpos.x + 2, cpos.y + 2),
                        ImVec2(cpos.x + csize.x - 2, cpos.y + 4),
                        ImColor(Style::Accent));

                    ImGui::SetCursorPos(ImVec2(6, 6));
                    ImGui::TextUnformatted("Players");

                    ImGui::Dummy(ImVec2(0, 10));

                    // Player list content
                    if (globals->players) {
                        auto all_players = globals->players->get_players();
                        auto local_player = globals->players->get_local_player();

                        for (size_t i = 0; i < all_players.size(); i++) {
                            auto player = all_players[i];
                            if (!player || player->address == 0) continue;
                            if (player->address == local_player->address) continue; // Skip local player

                            std::string player_name = player->get_name();
                            if (player_name.empty()) continue;

                            // Check if player is whitelisted
                            bool is_whitelisted = std::find(globals->whitelisted_players.begin(), 
                                                           globals->whitelisted_players.end(), 
                                                           player_name) != globals->whitelisted_players.end();

                            // Player row
                            ImGui::PushID(i);
                            
                            // Selection highlight
                            bool is_selected = (globals->selected_player_index == (int)i);
                            if (is_selected) {
                                ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.4f, 0.8f, 0.3f));
                            }
                            
                            // Player name button with display name and username
                            if (ImGui::Button("##player", ImVec2(ImGui::GetContentRegionAvail().x, 40))) {
                                globals->selected_player_index = (int)i;
                            }
                            
                            // Draw player info on the button
                            ImVec2 button_pos = ImGui::GetItemRectMin();
                            ImVec2 button_size = ImGui::GetItemRectSize();
                            
                            // Display name (main) - using player_name as display name for now
                            ImGui::SetCursorPos(ImVec2(button_pos.x - ImGui::GetWindowPos().x + 10, 
                                                       button_pos.y - ImGui::GetWindowPos().y + 8));
                            ImGui::TextColored(ImVec4(1.0f, 1.0f, 1.0f, 1.0f), "%s", player_name.c_str());
                            
                            // Username (smaller, below) - same name with @ prefix
                            ImGui::SetCursorPos(ImVec2(button_pos.x - ImGui::GetWindowPos().x + 10, 
                                                       button_pos.y - ImGui::GetWindowPos().y + 22));
                            ImGui::TextColored(ImVec4(0.7f, 0.7f, 0.7f, 1.0f), "@%s", player_name.c_str());
                            
                            if (is_selected) {
                                ImGui::PopStyleColor();
                            }

                            ImGui::PopID();
                        }
                    } else {
                        ImGui::Text("No players found");
                    }
                }
                ImGui::EndChild();
                ImGui::PopStyleColor();
            }
            ImGui::End();
        }

        // Player Info Window
        if (globals->player_list_enabled && menu_show && globals->selected_player_index >= 0) {
            if (globals->players) {
                auto all_players = globals->players->get_players();
                auto local_player = globals->players->get_local_player();
                
                if (globals->selected_player_index < (int)all_players.size()) {
                    auto player = all_players[globals->selected_player_index];
                    if (player && player->address != 0 && player->address != local_player->address) {
                        std::string player_name = player->get_name();
                        
                        ImGui::SetNextWindowSize(ImVec2(350, 200), ImGuiCond_FirstUseEver);
                        ImGui::SetNextWindowPos(ImVec2(720, 360), ImGuiCond_FirstUseEver);
                        ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);
                        ImGui::Begin("Player Info", nullptr, ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize);
                        {
                            ImGui::PopStyleVar();

                            ImVec2 pos = ImGui::GetWindowPos();
                            ImVec2 sz = ImGui::GetWindowSize();
                            ImDrawList* dl = ImGui::GetWindowDrawList();

                            Widgets::DrawBorder(dl, pos, sz, ImColor(Style::Border));
                            Widgets::DrawBorder(dl, pos, sz, ImColor(Style::BorderInner), 2);

                            ImVec2 ws = sz;

                            ImGui::SetCursorPos(ImVec2(8, 8));
                            ImGui::PushStyleColor(ImGuiCol_ChildBg, Style::MainChildBg);
                            ImGui::BeginChild("PlayerInfoMain", ImVec2(ws.x - 16, ws.y - 16), true);
                            {
                                ImVec2 cpos = ImGui::GetWindowPos();
                                ImVec2 csize = ImGui::GetWindowSize();

                                dl->AddRectFilled(ImVec2(cpos.x + 2, cpos.y + 2),
                                    ImVec2(cpos.x + csize.x - 2, cpos.y + 4),
                                    ImColor(Style::Accent));

                                ImGui::SetCursorPos(ImVec2(6, 6));
                                ImGui::TextUnformatted("Player Information");

                                ImGui::Dummy(ImVec2(0, 10));

                                // Player details
                                auto character = player->get_character();
                                if (character && character->address != 0) {
                                    auto hrp = character->find_first_child("HumanoidRootPart");
                                    auto humanoid = character->find_first_child("Humanoid");
                                    
                                    if (hrp && hrp->address != 0) {
                                        auto hrp_primitive = std::make_shared<sdk::c_primitives>(hrp->address);
                                        sdk::vector3_t position = hrp_primitive->get_translation();
                                        
                                        float health = 100.0f;
                                        float max_health = 100.0f;
                                        if (humanoid && humanoid->address != 0) {
                                            auto humanoid_primitive = std::make_shared<sdk::c_humanoid>(humanoid->address);
                                            health = humanoid_primitive->get_health();
                                            max_health = humanoid_primitive->get_max_health();
                                        }

                                        // Check if player is whitelisted
                                        bool is_whitelisted = std::find(globals->whitelisted_players.begin(), 
                                                                       globals->whitelisted_players.end(), 
                                                                       player_name) != globals->whitelisted_players.end();

                                        ImGui::Text("Player Name: %s", player_name.c_str());
                                        ImGui::Separator();
                                        ImGui::Text("Position: %.1f, %.1f, %.1f", position.m_x, position.m_y, position.m_z);
                                        ImGui::Text("Health: %.1f / %.1f", health, max_health);
                                        ImGui::Text("Status: %s", is_whitelisted ? "Whitelisted" : "Normal");
                                        
                                        ImGui::Dummy(ImVec2(0, 10));
                                        
                                        // Action buttons
                                        // Whitelist button
                                        if (is_whitelisted) {
                                            ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.8f, 0.2f, 0.8f));
                                            ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.9f, 0.3f, 0.9f));
                                        } else {
                                            ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.4f, 0.4f, 0.4f, 0.6f));
                                            ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.5f, 0.5f, 0.5f, 0.7f));
                                        }
                                        
                                        if (ImGui::Button(is_whitelisted ? "Remove Whitelist" : "Add Whitelist", ImVec2(150, 0))) {
                                            if (is_whitelisted) {
                                                globals->whitelisted_players.erase(
                                                    std::remove(globals->whitelisted_players.begin(), 
                                                              globals->whitelisted_players.end(), 
                                                              player_name), 
                                                    globals->whitelisted_players.end());
                                            } else {
                                                globals->whitelisted_players.push_back(player_name);
                                            }
                                        }
                                        ImGui::PopStyleColor(2);

                                        ImGui::SameLine();
                                        
                                        // Teleport button
                                        ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.6f, 0.8f, 0.8f));
                                        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.7f, 0.9f, 0.9f));
                                        if (ImGui::Button("Teleport", ImVec2(100, 0))) {
                                            if (local_player && local_player->get_character()) {
                                                auto local_hrp = local_player->get_character()->find_first_child("HumanoidRootPart");
                                                if (local_hrp && local_hrp->address != 0) {
                                                    auto local_hrp_primitive = std::make_shared<sdk::c_primitives>(local_hrp->address);
                                                    local_hrp_primitive->set_translation(position);
                                                }
                                            }
                                        }
                                        ImGui::PopStyleColor(2);
                                    }
                                }
                            }
                            ImGui::EndChild();
                            ImGui::PopStyleColor();
                        }
                        ImGui::End();
                    }
                }
            }
        }

        ImGui::Render();
        const float clear_color_with_alpha[4] = { clear_color.x * clear_color.w, clear_color.y * clear_color.w, clear_color.z * clear_color.w, clear_color.w };
        g_pd3dDeviceContext->OMSetRenderTargets(1, &g_mainRenderTargetView, nullptr);
        g_pd3dDeviceContext->ClearRenderTargetView(g_mainRenderTargetView, clear_color_with_alpha);
        ImGui_ImplDX11_RenderDrawData(ImGui::GetDrawData());

        //HRESULT hr = g_pSwapChain->Present(1, 0);
        HRESULT hr = g_pSwapChain->Present(0, 0);
        g_SwapChainOccluded = (hr == DXGI_STATUS_OCCLUDED);
    }

    ImGui_ImplDX11_Shutdown();
    ImGui_ImplWin32_Shutdown();
    ImGui::DestroyContext();

    CleanupDeviceD3D();
    ::DestroyWindow(hwnd);
    ::UnregisterClassW(wc.lpszClassName, wc.hInstance);

    return 0;
}

bool CreateDeviceD3D(HWND hWnd)
{

    DXGI_SWAP_CHAIN_DESC sd;
    ZeroMemory(&sd, sizeof(sd));
    sd.BufferCount = 2;
    sd.BufferDesc.Width = 0;
    sd.BufferDesc.Height = 0;
    sd.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    sd.BufferDesc.RefreshRate.Numerator = 60;
    sd.BufferDesc.RefreshRate.Denominator = 1;
    sd.Flags = DXGI_SWAP_CHAIN_FLAG_ALLOW_MODE_SWITCH;
    sd.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    sd.OutputWindow = hWnd;
    sd.SampleDesc.Count = 1;
    sd.SampleDesc.Quality = 0;
    sd.Windowed = TRUE;
    sd.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

    UINT createDeviceFlags = 0;

    D3D_FEATURE_LEVEL featureLevel;
    const D3D_FEATURE_LEVEL featureLevelArray[2] = { D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_0, };
    HRESULT res = D3D11CreateDeviceAndSwapChain(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, createDeviceFlags, featureLevelArray, 2, D3D11_SDK_VERSION, &sd, &g_pSwapChain, &g_pd3dDevice, &featureLevel, &g_pd3dDeviceContext);
    if (res == DXGI_ERROR_UNSUPPORTED)
        res = D3D11CreateDeviceAndSwapChain(nullptr, D3D_DRIVER_TYPE_WARP, nullptr, createDeviceFlags, featureLevelArray, 2, D3D11_SDK_VERSION, &sd, &g_pSwapChain, &g_pd3dDevice, &featureLevel, &g_pd3dDeviceContext);
    if (res != S_OK)
        return false;

    CreateRenderTarget();
    return true;
}

void CleanupDeviceD3D()
{
    CleanupRenderTarget();
    if (g_pSwapChain) { g_pSwapChain->Release(); g_pSwapChain = nullptr; }
    if (g_pd3dDeviceContext) { g_pd3dDeviceContext->Release(); g_pd3dDeviceContext = nullptr; }
    if (g_pd3dDevice) { g_pd3dDevice->Release(); g_pd3dDevice = nullptr; }
}

void CreateRenderTarget()
{
    ID3D11Texture2D* pBackBuffer;
    g_pSwapChain->GetBuffer(0, IID_PPV_ARGS(&pBackBuffer));
    g_pd3dDevice->CreateRenderTargetView(pBackBuffer, nullptr, &g_mainRenderTargetView);
    pBackBuffer->Release();
}

void CleanupRenderTarget()
{
    if (g_mainRenderTargetView) { g_mainRenderTargetView->Release(); g_mainRenderTargetView = nullptr; }
}

extern IMGUI_IMPL_API LRESULT ImGui_ImplWin32_WndProcHandler(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);

LRESULT WINAPI WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    if (ImGui_ImplWin32_WndProcHandler(hWnd, msg, wParam, lParam))
        return true;

    switch (msg)
    {
    case WM_SIZE:
        if (wParam == SIZE_MINIMIZED)
            return 0;
        g_ResizeWidth = (UINT)LOWORD(lParam);
        g_ResizeHeight = (UINT)HIWORD(lParam);
        return 0;
    case WM_SYSCOMMAND:
        if ((wParam & 0xfff0) == SC_KEYMENU)
            return 0;
        break;
    case WM_DESTROY:
        ::PostQuitMessage(0);
        return 0;
    }
    return ::DefWindowProcW(hWnd, msg, wParam, lParam);
}
