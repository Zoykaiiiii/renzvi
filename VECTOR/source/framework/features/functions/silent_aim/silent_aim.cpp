#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/features/functions/silent_aim/silent_aim.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/utils/memory/memory.hpp>
#include <source/framework/features/cache/cache.hpp>

#include <source/framework/sdk/offsets/offsets.hpp>

inline sdk::vector3_t normalize_vector(const sdk::vector3_t& v) {
    float length_sq = v.m_x * v.m_x + v.m_y * v.m_y + v.m_z * v.m_z;
    if (length_sq < 0.0001f) return { 0, 0, 0 };

    float inv_length = 1.0f / std::sqrt(length_sq);
    return { v.m_x * inv_length, v.m_y * inv_length, v.m_z * inv_length };
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

std::string features::c_silent_aim::get_target_part_name()
{
    switch (globals->silent_aim_target_part)
    {
    case 0: return "Head";
    case 1: return "Torso";
    case 2: return "HumanoidRootPart";
    default: return "Head";
    }
}

sdk::vector3_t features::c_silent_aim::get_target_position()
{
    try {
        if (!current_target || !current_target->alive)
            return { 0, 0, 0 };

        auto target_part = current_target->get_part(get_target_part_name());
        if (!target_part)
            return { 0, 0, 0 };

        return target_part->get_translation();
    }
    catch (...) {
        return { 0, 0, 0 };
    }
}

std::unique_ptr<entity> features::c_silent_aim::find_closest_target()
{
    try {
        if (!globals->players || !globals->camera) return nullptr;

        // Ensure cache is updated before searching for targets
        features::cache->update();

        sdk::vector3_t camera_pos = globals->camera->get_camera_translation();
        sdk::matrix3_t cam_rot = globals->camera->get_camera_rotation();
        sdk::vector3_t camera_forward = { -cam_rot.m_data[0][2], -cam_rot.m_data[1][2], -cam_rot.m_data[2][2] };
        std::unique_ptr<entity> closest_entity = nullptr;
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

                auto target_part = character->find_first_child(get_target_part_name());
                if (!target_part || target_part->address == 0) continue;

                auto part_primitives = std::make_shared<sdk::c_primitives>(target_part->address);
                sdk::vector3_t part_pos = part_primitives->get_translation();

                float distance = vector_distance(camera_pos, part_pos);

                if (globals->silent_aim_targeting_mode == 0 && globals->silent_aim_distance_limit && distance > globals->silent_aim_max_distance)
                {
                    continue;
                }

                float metric = distance;
                if (globals->silent_aim_targeting_mode == 1)
                {
                    sdk::vector3_t to_target = normalize_vector({ part_pos.m_x - camera_pos.m_x, part_pos.m_y - camera_pos.m_y, part_pos.m_z - camera_pos.m_z });
                    float dp = std::clamp(dot_product(normalize_vector(camera_forward), to_target), -1.0f, 1.0f);
                    float angle_deg = std::acos(dp) * 180.0f / 3.14159265f;
                    if (angle_deg > globals->silent_aim_fov_size)
                    {
                        continue;
                    }
                    metric = angle_deg;
                }

                // Wallcheck for silent aim
                if (globals->silent_aim_wallcheck) {
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
                auto ent = std::make_unique<entity>();
                ent->plr_address = player->address;
                ent->plr_modelinstance = character->address;
                ent->alive = (cache_entity && cache_entity->alive);

                // Get the specific target part from cache if available
                if (cache_entity && cache_entity->alive) {
                    auto target_part = cache_entity->get_part(get_target_part_name());
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
                    closest_entity = std::move(ent);
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

bool features::c_silent_aim::has_valid_target()
{
    try {
        if (!current_target || !current_target->alive) {
            current_target = nullptr;
            return false;
        }
        auto target_part = current_target->get_part(get_target_part_name());
        if (!target_part) {
            current_target = nullptr;
            return false;
        }
        return true;
    }
    catch (...) {
        current_target = nullptr;
        return false;
    }
}

void features::c_silent_aim::apply_silent_aim(const sdk::vector3_t& target_pos)
{
    try {
        POINT cursor_point;
        GetCursorPos(&cursor_point);
        ScreenToClient(FindWindowA(nullptr, "Roblox"), &cursor_point);

        sdk::vector2_t cursor = {
            static_cast<float>(cursor_point.x),
            static_cast<float>(cursor_point.y)
        };

       // if (!globals->visual_engine) return;

        auto view_port = globals->visual_engine->get_view_port();
        auto view_matrix = globals->visual_engine->get_view_matrix();
        auto screen_pos = globals->visual_engine->world_to_screen(target_pos, view_port, view_matrix.m_data);

       // if (screen_pos.m_x <= 0 || screen_pos.m_y <= 0) return;

        float screen_height = view_port.m_y;
        uint64_t new_position_x = static_cast<uint64_t>(screen_pos.m_x);
        uint64_t new_position_y = static_cast<uint64_t>(screen_height - std::abs(screen_height - screen_pos.m_y));

        float new_mouse_x = static_cast<float>(cursor_point.x);
        float new_mouse_y = static_cast<float>(screen_height - std::abs(screen_height - cursor_point.y));
        auto local_player = globals->players->get_local_player();
        if (!local_player) return;
        
        auto player_gui = local_player->find_first_child("PlayerGui");
        if (!player_gui) return;
        
        auto main_screen_gui = player_gui->find_first_child("MainScreenGui");
        if (!main_screen_gui) return;
        
        auto aim_instance = main_screen_gui->find_first_child("Aim");
        if (!aim_instance) return;

        auto aim_obj = std::make_shared<sdk::c_gui_object>(aim_instance->address);
        sdk::vector2_t new_mouse_pos{ new_mouse_x, new_mouse_y };
        //aim_obj->set_frame(new_mouse_pos);

        //aim_obj->set_frame_x(new_mouse_x);
        //aim_obj->set_frame_y(new_mouse_y);

        auto input_obj = std::make_shared<sdk::c_mouse_service>(g_memory->read<uintptr_t>(globals->mouse_service->address + sdk::offsets::mouseservice::input_object));
        input_obj->set_mouse({ static_cast<float>(new_position_x), static_cast<float>(new_position_y) });
    }
    catch (...) {
        // Silent failure - don't crash the application
    }
}


void features::c_silent_aim::initialize()
{
    try {
        static sdk::vector3_t prev_target_pos = { 0, 0, 0 };

        while (true) {
            try {
               std::this_thread::sleep_for(std::chrono::milliseconds(1));
              //  if (globals->silent_aim_enabled) {
                    if (!globals->silent_aim_enabled || !globals->camera) continue;

                    globals->silent_aim_keybind.Update();
                    if (!globals->silent_aim_keybind.enabled) {
                        current_target = nullptr;
                        continue;
                    }

                    if (!current_target || !has_valid_target()) {
                        current_target = find_closest_target();
                        if (!current_target) continue;
                    }

                    auto target_part = current_target->get_part(get_target_part_name());
                    if (!target_part) {
                        current_target = nullptr;
                        continue;
                    }

                    sdk::vector3_t target_pos = target_part->get_translation();
                    sdk::vector3_t cam_pos = globals->camera->get_camera_translation();
                    if (globals->silent_aim_distance_limit && vector_distance(cam_pos, target_pos) > globals->silent_aim_max_distance) {
                        current_target = nullptr;
                        continue;
                    }

                    if (target_pos.m_x == prev_target_pos.m_x &&
                        target_pos.m_y == prev_target_pos.m_y &&
                        target_pos.m_z == prev_target_pos.m_z)
                        continue;

                    prev_target_pos = target_pos;

                    apply_silent_aim(target_pos);
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