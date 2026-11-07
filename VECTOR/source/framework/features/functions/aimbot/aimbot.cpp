#include "aimbot.hpp"
#include <cmath>
#include <algorithm>
#include <random>
#include <chrono>

#include <source/framework/sdk/offsets/offsets.hpp>
#include <source/framework/features/cache/cache.hpp>

// Easing functions
static float Ease(float t) {
    // Early exit for extremes
    if (t <= 0.0f) return 0.0f;
    if (t >= 1.0f) return 1.0f;

    switch (globals->aimlock_easing_style) {
    case 0: return t; // Linear
    case 1: return 1.0f - std::cos((t * 3.14159265f) * 0.5f); // Ease Out Sine
    default: return t;
    }
}

static float SmoothEase(float t, float strength = 1.2f) {
    t = Ease(t);
    return std::pow(t, strength);
}

struct myvec3_t { float x, y, z; };

myvec3_t cross(const myvec3_t& a, const myvec3_t& b)
{
    return { a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x };
}

void normalize(myvec3_t& v)
{
    float len = sqrtf(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len > 0.f) { v.x /= len; v.y /= len; v.z /= len; }
}

struct mymat3x3_t
{
    float _11, _12, _13;
    float _21, _22, _23;
    float _31, _32, _33;
};

mymat3x3_t create_look_at_matrix(const myvec3_t& cam_pos, const myvec3_t& target_pos)
{
    myvec3_t forward = { target_pos.x - cam_pos.x, target_pos.y - cam_pos.y, target_pos.z - cam_pos.z };
    normalize(forward);

    myvec3_t world_up = { 0.f, 1.f, 0.f };
    myvec3_t right = cross(world_up, forward);
    normalize(right);

    myvec3_t up = cross(forward, right);
    normalize(up);

    mymat3x3_t lookAtMatrix;
    lookAtMatrix._11 = -right.x;  lookAtMatrix._12 = up.x;  lookAtMatrix._13 = -forward.x;
    lookAtMatrix._21 = right.y;   lookAtMatrix._22 = up.y;  lookAtMatrix._23 = -forward.y;
    lookAtMatrix._31 = -right.z;  lookAtMatrix._32 = up.z;  lookAtMatrix._33 = -forward.z;

    return lookAtMatrix;
}
float lerp(float a, float b, float t)
{
    return a + (b - a) * t;
}

// OPTIMIZED MATRIX INTERPOLATION
mymat3x3_t Slerp_Matrix3(const mymat3x3_t& a, const mymat3x3_t& b, float t) {
    if (t >= 1.0f) return b;
    if (t <= 0.0f) return a;

    mymat3x3_t result;
    // Unrolled loop for better performance
    result._11 = a._11 + (b._11 - a._11) * t;
    result._12 = a._12 + (b._12 - a._12) * t;
    result._13 = a._13 + (b._13 - a._13) * t;
    result._21 = a._21 + (b._21 - a._21) * t;
    result._22 = a._22 + (b._22 - a._22) * t;
    result._23 = a._23 + (b._23 - a._23) * t;
    result._31 = a._31 + (b._31 - a._31) * t;
    result._32 = a._32 + (b._32 - a._32) * t;
    result._33 = a._33 + (b._33 - a._33) * t;

    return result;
}


inline sdk::vector3_t normalize_vector(const sdk::vector3_t& v) {
    float length_sq = v.m_x * v.m_x + v.m_y * v.m_y + v.m_z * v.m_z;
    if (length_sq < 0.0001f) return { 0, 0, 0 };

    float inv_length = 1.0f / std::sqrt(length_sq);
    return { v.m_x * inv_length, v.m_y * inv_length, v.m_z * inv_length };
}

inline sdk::vector3_t cross_product(const sdk::vector3_t& a, const sdk::vector3_t& b) {
    return {
        a.m_y * b.m_z - a.m_z * b.m_y,
        a.m_z * b.m_x - a.m_x * b.m_z,
        a.m_x * b.m_y - a.m_y * b.m_x
    };
}

inline float dot_product(const sdk::vector3_t& a, const sdk::vector3_t& b) {
    return a.m_x * b.m_x + a.m_y * b.m_y + a.m_z * b.m_z;
}

inline float vector_distance(const sdk::vector3_t& a, const sdk::vector3_t& b) {
    float dx = a.m_x - b.m_x;
    float dy = a.m_y - b.m_y;
    float dz = a.m_z - b.m_z;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

inline bool matrices_near_equal(const sdk::matrix3_t& a, const sdk::matrix3_t& b, float epsilon = 1e-4f) {
    for (int r = 0; r < 3; ++r) {
        for (int c = 0; c < 3; ++c) {
            if (std::fabs(a.m_data[r][c] - b.m_data[r][c]) > epsilon) {
                return false;
            }
        }
    }
    return true;
}
inline float get_system_dpi_scale()
{
    HMODULE user32 = GetModuleHandleA("user32.dll");
    if (user32) {
        using GetDpiForSystem_t = UINT(WINAPI*)();
        auto pGetDpiForSystem = (GetDpiForSystem_t)GetProcAddress(user32, "GetDpiForSystem");
        if (pGetDpiForSystem) {
            UINT dpi = pGetDpiForSystem();
            return static_cast<float>(dpi) / 96.0f;
        }
    }
    // fallback here
    HDC dc = GetDC(NULL);
    int dpi_x = GetDeviceCaps(dc, LOGPIXELSX);
    ReleaseDC(NULL, dc);
    return static_cast<float>(dpi_x) / 96.0f;
}


inline void send_mouse_delta(int dx, int dy)
{
    INPUT input = {};
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
    SendInput(1, &input, sizeof(input));
}

static float randf(float a, float b) {
    static std::mt19937 rng((unsigned)time(nullptr));
    std::uniform_real_distribution<float> d(a, b);
    return d(rng);
}


std::string features::c_player_lock::get_part_name()
{
    switch (globals->aimlock_target_part)
    {
    case 0: return "Head";
    case 1: return "Torso";
    case 2: return "HumanoidRootPart";
    default: return "Head";
    }
}

sdk::vector3_t features::c_player_lock::get_target_position()
{
    try {
        if (!globals->aimlock_current_target || !globals->aimlock_current_target->alive)
            return { 0, 0, 0 };

        auto target_part = globals->aimlock_current_target->get_part(get_part_name());
        if (!target_part)
            return { 0, 0, 0 };

        return target_part->get_translation();
    }
    catch (...) {
        return { 0, 0, 0 };
    }
}

entity* features::c_player_lock::find_closest_target()
{
    try {
        if (!globals->players || !globals->camera) return nullptr;

        // Ensure cache is updated before searching for targets
        features::cache->update();

        sdk::vector3_t camera_pos = globals->camera->get_camera_translation();
        sdk::matrix3_t cam_rot = globals->camera->get_camera_rotation();
        sdk::vector3_t camera_forward = { -cam_rot.m_data[0][2], -cam_rot.m_data[1][2], -cam_rot.m_data[2][2] };
        entity* closest_entity = nullptr;
        float best_metric = FLT_MAX;

        auto local_player = globals->players->get_local_player();
        if (!local_player) return nullptr;

        std::string local_name = local_player->get_name();

        auto players_children = globals->players->get_children();

        for (auto& player_instance : players_children)
        {
            try {
                if (!player_instance || player_instance->address == 0) continue;

                auto player = std::make_shared<sdk::c_player>(player_instance->address);

                if (globals->local_player_check && player->get_name() == local_name)
                    continue;

                if (globals->team_check) {
                    auto local_team = local_player->get_team();
                    auto player_team = player->get_team();
                    if (local_team && player_team && local_team->address == player_team->address)
                        continue;
                }

                // Check if player is whitelisted
                std::string player_name = player->get_name();
                bool is_whitelisted = std::find(globals->whitelisted_players.begin(), 
                                               globals->whitelisted_players.end(), 
                                               player_name) != globals->whitelisted_players.end();
                if (is_whitelisted) continue;


                auto character = player->get_character();
                if (!character || character->address == 0) continue;

                auto target_part = character->find_first_child(get_part_name());
                if (!target_part || target_part->address == 0) continue;

                auto part_primitives = std::make_shared<sdk::c_primitives>(target_part->address);
                sdk::vector3_t part_pos = part_primitives->get_translation();

                float distance = vector_distance(camera_pos, part_pos);

                if (globals->aimlock_targeting_mode == 0 && globals->aimlock_distance_limit && distance > globals->aimlock_max_distance)
                {
                    continue;
                }

                float metric = distance;
                if (globals->aimlock_targeting_mode == 1)
                {
                    sdk::vector3_t to_target = normalize_vector({ part_pos.m_x - camera_pos.m_x, part_pos.m_y - camera_pos.m_y, part_pos.m_z - camera_pos.m_z });
                    float dp = std::clamp(dot_product(normalize_vector(camera_forward), to_target), -1.0f, 1.0f);
                    float angle_deg = std::acos(dp) * 180.0f / 3.14159265f;
                    if (angle_deg > globals->aimlock_fov_size)
                    {
                        continue;
                    }
                    metric = angle_deg;
                }

                // Wallcheck for aimbot
                if (globals->aimbot_wallcheck) {
                    try {
                        auto& world_parts = features::wallcheck::get_static_world_parts();
                        if (!features::wallcheck::is_point_visible(camera_pos, part_pos, world_parts)) {
                            continue; // Skip this target if not visible
                        }
                    } catch (...) {
                        // Continue if wallcheck fails
                    }
                }


                // Use the cache system to get the target part directly
                auto cache_entity = features::cache->find_by_name(player->get_name());
                auto ent = new entity();
                ent->plr_address = player->address;
                ent->plr_modelinstance = character->address;
                ent->alive = (cache_entity && cache_entity->alive);

                // Get the specific target part from cache if available
                if (cache_entity && cache_entity->alive) {
                    auto target_part = cache_entity->get_part(get_part_name());
                    if (target_part) {
                        // Store the target part in all_parts for the get_part method to find
                        ent->all_parts.emplace_back(std::make_shared<sdk::c_instance>(target_part->address), e_part_type::hitbox);
                    } else {
                        // Fallback: create from the character directly
                        ent->all_parts.emplace_back(std::make_shared<sdk::c_instance>(character->address), e_part_type::hitbox);
                    }
                } else {
                    // Fallback: create from the character directly
                    ent->all_parts.emplace_back(std::make_shared<sdk::c_instance>(character->address), e_part_type::hitbox);
                }

                if (metric < best_metric) {
                    best_metric = metric;
                    if (closest_entity) delete closest_entity;
                    closest_entity = ent;
                } 
                else {
                    delete ent;
                }
            }
            catch (...) {
                continue;
            }
        }

        return closest_entity;
    }
    catch (...) {
        return nullptr;
    }
}

bool features::c_player_lock::has_valid_target()
{
    try {
        if (!globals->aimlock_current_target) return false;
        if (!globals->aimlock_current_target->alive) { globals->aimlock_current_target = nullptr; return false; }
        auto target_part = globals->aimlock_current_target->get_part(get_part_name());
        if (!target_part) { globals->aimlock_current_target = nullptr; return false; }
        return true;
    }
    catch (...) {
        globals->aimlock_current_target = nullptr;
        return false;
    }
}
void features::c_player_lock::update()
{
    try {
        static mymat3x3_t current_rot = {};
        static float dpi_scale = get_system_dpi_scale();
        static myvec3_t prev_target_pos = { 0,0,0 };

        while (true) {
            try {
                if (globals->aimlock_enabled) {
                    if (!globals->aimlock_enabled || !globals->camera) continue;

                    globals->aimlock_keybind.Update();
                    if (!globals->aimlock_keybind.enabled) {
                        globals->aimlock_current_target = nullptr;
                        continue;
                    }

                    if (!globals->aimlock_current_target || !has_valid_target()) {
                        globals->aimlock_current_target = find_closest_target();
                        if (!globals->aimlock_current_target) continue;
                    }

                    auto target_part = globals->aimlock_current_target->get_part(get_part_name());
                    if (!target_part) {
                        globals->aimlock_current_target = nullptr;
                        continue;
                    }

                    sdk::vector3_t target_pos = target_part->get_translation();
                    sdk::vector3_t cam_pos = globals->camera->get_camera_translation();

                    // Check if current target is still visible (wallcheck)
                    if (globals->aimbot_wallcheck) {
                        try {
                            auto& world_parts = features::wallcheck::get_static_world_parts();
                            if (!features::wallcheck::is_point_visible(cam_pos, target_pos, world_parts)) {
                                // Target became invisible, stop locking
                                globals->aimlock_current_target = nullptr;
                                continue;
                            }
                        } catch (...) {
                            // Continue if wallcheck fails
                        }
                    }

                    // Apply velocity prediction if enabled
                    if (globals->aimlock_prediction) {
                        sdk::vector3_t target_velocity = target_part->get_velocity();
                        
                        // Calculate prediction time based on distance
                        float distance = vector_distance(cam_pos, target_pos);
                        float prediction_time = distance / 1000.0f; // Adjust this multiplier as needed
                        
                        // Apply prediction multipliers
                        target_velocity.m_x *= globals->aimlock_prediction_x;
                        target_velocity.m_y *= globals->aimlock_prediction_y;
                        target_velocity.m_z *= globals->aimlock_prediction_z;
                        
                        // Predict future position
                        target_pos.m_x += target_velocity.m_x * prediction_time;
                        target_pos.m_y += target_velocity.m_y * prediction_time;
                        target_pos.m_z += target_velocity.m_z * prediction_time;
                    }

                    // Apply ground detection offset if enabled
                    if (globals->aimlock_ground_detection) {
                        // Check if target is on ground (Y position <= 3.0f)
                        if (target_pos.m_y <= 3.0f) {
                            target_pos.m_y += globals->aimlock_offset_y; // Aim slightly above ground targets
                        }
                    }

                    // Apply manual offsets if enabled
                    if (globals->aimlock_offset_enabled) {
                        target_pos.m_x += globals->aimlock_offset_x;
                        target_pos.m_y += globals->aimlock_offset_y;
                    }

                    // Apply shaking if enabled
                    if (globals->aimlock_shaking_enabled) {
                        static std::mt19937 rng(std::chrono::steady_clock::now().time_since_epoch().count());
                        std::uniform_real_distribution<float> shake_dist(-1.0f, 1.0f);
                        
                        float shake_x = shake_dist(rng) * globals->aimlock_shaking_intensity;
                        float shake_y = shake_dist(rng) * globals->aimlock_shaking_intensity;
                        
                        target_pos.m_x += shake_x;
                        target_pos.m_y += shake_y;
                    }

                    if (globals->aimlock_distance_limit && vector_distance(cam_pos, target_pos) > globals->aimlock_max_distance) {
                        globals->aimlock_current_target = nullptr;
                        continue;
                    }

                    if (target_pos.m_x == prev_target_pos.x && target_pos.m_y == prev_target_pos.y && target_pos.m_z == prev_target_pos.z)
                        continue;
                    prev_target_pos = { target_pos.m_x, target_pos.m_y, target_pos.m_z };

                    if (globals->aimlock_mode == 0) {
                        myvec3_t cam{ cam_pos.m_x, cam_pos.m_y, cam_pos.m_z };
                        myvec3_t target{ target_pos.m_x, target_pos.m_y, target_pos.m_z };

                        mymat3x3_t target_rot = create_look_at_matrix(cam, target);
                        
                        if (globals->aimlock_smoothing_enabled) {
                            mymat3x3_t lerped_rotation;
                            
                            if (globals->aimlock_smoothing_type == 0) {
                                // Normal smoothing
                                float smoothness_factor = (100.1f - globals->aimlock_smoothness) / 100.0f;
                                smoothness_factor *= 0.1f; // Make it even more gradual
                                lerped_rotation = Slerp_Matrix3(current_rot, target_rot, smoothness_factor);
                            } else {
                                // X/Y separate smoothing
                                float smooth_factor_x = std::clamp(globals->aimlock_smoothing_x, 0.01f, 1.0f);
                                float smooth_factor_y = std::clamp(globals->aimlock_smoothing_y, 0.01f, 1.0f);
                                
                                // Apply smoothing separately for X and Y rotation
                                lerped_rotation = current_rot;
                                
                                // Smooth X rotation (yaw)
                                lerped_rotation._11 = current_rot._11 + (target_rot._11 - current_rot._11) * smooth_factor_x;
                                lerped_rotation._12 = current_rot._12 + (target_rot._12 - current_rot._12) * smooth_factor_x;
                                lerped_rotation._13 = current_rot._13 + (target_rot._13 - current_rot._13) * smooth_factor_x;
                                
                                // Smooth Y rotation (pitch)
                                lerped_rotation._21 = current_rot._21 + (target_rot._21 - current_rot._21) * smooth_factor_y;
                                lerped_rotation._22 = current_rot._22 + (target_rot._22 - current_rot._22) * smooth_factor_y;
                                lerped_rotation._23 = current_rot._23 + (target_rot._23 - current_rot._23) * smooth_factor_y;
                                
                                // Keep Z rotation unchanged for stability
                                lerped_rotation._31 = current_rot._31;
                                lerped_rotation._32 = current_rot._32;
                                lerped_rotation._33 = current_rot._33;
                            }
                            
                            // Allow manual camera movement by blending with current camera rotation
                            sdk::matrix3_t current_cam_rot = globals->camera->get_camera_rotation();
                            mymat3x3_t manual_rot = {
                                current_cam_rot.m_data[0][0], current_cam_rot.m_data[0][1], current_cam_rot.m_data[0][2],
                                current_cam_rot.m_data[1][0], current_cam_rot.m_data[1][1], current_cam_rot.m_data[1][2],
                                current_cam_rot.m_data[2][0], current_cam_rot.m_data[2][1], current_cam_rot.m_data[2][2]
                            };
                            
                            // Blend manual input with aimbot (90% manual, 10% aimbot for smooth following)
                            mymat3x3_t final_rot = Slerp_Matrix3(manual_rot, lerped_rotation, 0.1f);
                            
                            g_memory->write<mymat3x3_t>(globals->camera->address + sdk::offsets::camera::rotation, final_rot);
                            current_rot = final_rot; // Update current rotation for next frame
                        } else {
                            g_memory->write<mymat3x3_t>(globals->camera->address + sdk::offsets::camera::rotation, target_rot);
                            current_rot = target_rot; // Update current rotation
                        }
                    }
                    else if (globals->aimlock_mode == 1 && globals->visual_engine) {
                        auto view_port = globals->visual_engine->get_view_port();
                        auto view_matrix = globals->visual_engine->get_view_matrix();

                        auto screen_pos = globals->visual_engine->world_to_screen(target_pos, view_port, view_matrix.m_data);
                        if (screen_pos.m_x <= 0 || screen_pos.m_y <= 0) continue;

                        POINT cursor_pos;
                        GetCursorPos(&cursor_pos);
                        HWND roblox_window = FindWindowA(nullptr, "Roblox");
                        if (!roblox_window) continue;
                        ScreenToClient(roblox_window, &cursor_pos);

                        float target_x = screen_pos.m_x * dpi_scale;
                        float target_y = screen_pos.m_y * dpi_scale;
                        float current_x = cursor_pos.x * dpi_scale;
                        float current_y = cursor_pos.y * dpi_scale;

                        float dx = target_x - current_x;
                        float dy = target_y - current_y;

                        if (globals->aimlock_smoothing_enabled) {
                            if (globals->aimlock_smoothing_type == 0) {
                                // Normal smoothing for mouse mode
                                float smoothness_factor = (100.1f - globals->aimlock_smoothness) / 100.0f;
                                smoothness_factor *= 0.05f; // Make it very gradual
                                
                                dx *= smoothness_factor;
                                dy *= smoothness_factor;
                            } else {
                                // X/Y separate smoothing for mouse mode
                                float smooth_factor_x = std::clamp(globals->aimlock_smoothing_x, 0.01f, 1.0f);
                                float smooth_factor_y = std::clamp(globals->aimlock_smoothing_y, 0.01f, 1.0f);
                                
                                dx *= smooth_factor_x;
                                dy *= smooth_factor_y;
                            }
                        }

                        if (std::abs(dx) > 0.5f || std::abs(dy) > 0.5f) send_mouse_delta((int)dx, (int)dy);
                    }
                    else if (globals->aimlock_mode == 2 && globals->visual_engine) {
                        auto view_port = globals->visual_engine->get_view_port();
                        auto view_matrix = globals->visual_engine->get_view_matrix();
                        auto screen_pos = globals->visual_engine->world_to_screen(target_pos, view_port, view_matrix.m_data);

                        if (screen_pos.m_x <= 0 || screen_pos.m_y <= 0) continue;

                        float screen_height = view_port.m_y;
                        uint64_t new_position_x = static_cast<uint64_t>(screen_pos.m_x);
                        uint64_t new_position_y = static_cast<uint64_t>(screen_height - std::abs(screen_height - screen_pos.m_y));
                        auto input_obj = std::make_shared<sdk::c_mouse_service>(g_memory->read<uintptr_t>(globals->mouse_service->address + sdk::offsets::mouseservice::input_object));
                        input_obj->set_mouse({ static_cast<float>(new_position_x), static_cast<float>(new_position_y) });

                        //  if (std::abs(dx) > 1.0f || std::abs(dy) > 1.0f) send_mouse_delta((int)dx, (int)dy);
                    }
                }
            }
            catch (...) {
                continue;
            }
        }
    }
    catch (...) {
        // Silent failure - don't crash the application
    }
}