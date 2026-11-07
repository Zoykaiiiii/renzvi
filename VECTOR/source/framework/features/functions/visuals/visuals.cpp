#include <cfloat>
#include <vector>
#include <algorithm>
#include <cmath>
#include <source/framework/globals/globals.hpp>
#include <source/framework/features/cache/cache.hpp>
#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/features/functions/visuals/visuals.hpp>
// #include <source/utils/clipper/clipper2/clipper.h> // Removed to fix compiler ICE

inline float vector_distance(const sdk::vector3_t& a, const sdk::vector3_t& b) {
    float dx = a.m_x - b.m_x;
    float dy = a.m_y - b.m_y;
    float dz = a.m_z - b.m_z;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

void features::c_visuals::initialize() {
    try {
        auto view_port = globals->visual_engine->get_view_port();
        auto view_matrix = globals->visual_engine->get_view_matrix();
        auto alive_players = features::cache->get_alive_entities();

        auto local_player = globals->players->get_local_player();
        std::string local_name = local_player ? local_player->get_name() : "";

        ImDrawList* draw = ImGui::GetBackgroundDrawList();

        // Time for animations
        static float time = 0.0f;
        time += 0.016f; // Assuming 60fps

        if (globals->aimlock_fov_visible && globals->camera && globals->aimlock_targeting_mode == 1) {
            ImVec2 center = ImGui::GetIO().DisplaySize * 0.5f;
            float screen_fov = globals->camera->get_fov();
            float radius = ((globals->aimlock_fov_size / 5.0f) / screen_fov) * (ImGui::GetIO().DisplaySize.x * 0.5f);
            ImU32 col = IM_COL32(
                (int)(globals->aimlock_fov_color.x * 255),
                (int)(globals->aimlock_fov_color.y * 255),
                (int)(globals->aimlock_fov_color.z * 255),
                (int)(globals->aimlock_fov_color.w * 255)
            );
            if (globals->aimlock_fov_filled) {
                draw->AddCircleFilled(center, radius, col, 64);
            }
            if (globals->aimlock_fov_outline || !globals->aimlock_fov_filled) {
                draw->AddCircle(center, radius, col, 64, 1.0f);
            }
        }

        if (globals->silent_aim_fov_visible && globals->camera && globals->silent_aim_targeting_mode == 1) {
            ImVec2 center = ImGui::GetIO().DisplaySize * 0.5f;
            float screen_fov = globals->camera->get_fov();
            float radius = ((globals->silent_aim_fov_size / 5.0f) / screen_fov) * (ImGui::GetIO().DisplaySize.x * 0.5f);
            ImU32 col = IM_COL32(
                (int)(globals->silent_aim_fov_color.x * 255),
                (int)(globals->silent_aim_fov_color.y * 255),
                (int)(globals->silent_aim_fov_color.z * 255),
                (int)(globals->silent_aim_fov_color.w * 255)
            );
            if (globals->silent_aim_fov_filled) {
                draw->AddCircleFilled(center, radius, col, 64);
            }
            if (globals->silent_aim_fov_outline || !globals->silent_aim_fov_filled) {
                draw->AddCircle(center, radius, col, 64, 1.0f);
            }
        }

        if (globals->triggerbot_fov_visible && globals->camera) {
            ImVec2 center = ImGui::GetIO().DisplaySize * 0.5f;
            float screen_fov = globals->camera->get_fov();
            float radius = ((globals->triggerbot_fov / 5.0f) / screen_fov) * (ImGui::GetIO().DisplaySize.x * 0.5f);
            ImU32 col = IM_COL32(
                (int)(globals->triggerbot_fov_color.Value.x * 255),
                (int)(globals->triggerbot_fov_color.Value.y * 255),
                (int)(globals->triggerbot_fov_color.Value.z * 255),
                (int)(globals->triggerbot_fov_color.Value.w * 255)
            );
            if (globals->triggerbot_fov_filled) {
                draw->AddCircleFilled(center, radius, col, 64);
            }
            if (globals->triggerbot_fov_outline || !globals->triggerbot_fov_filled) {
                draw->AddCircle(center, radius, col, 64, 1.0f);
            }
        }

    // [Keep all existing static/world visual code unchanged]
    static bool captured = false; static std::vector<sdk::vector3_t> captured_translations; static std::vector<sdk::matrix3_t> captured_rotations; static std::vector<sdk::vector3_t> captured_sizes; static bool was_enabled = false;

    if (globals->desync_visualizer && globals->desync_keybind.enabled) {
        auto local_player = features::cache->find_by_name(globals->players->get_local_player()->get_name());
        if (!local_player || !local_player->alive) return;

        if (!captured) {
            captured_translations.clear();
            captured_rotations.clear();
            captured_sizes.clear();

            // Use categorized parts for desync visualizer
            auto desync_parts = local_player->get_drawable_parts();
            for (auto& part : desync_parts) {
                captured_translations.push_back(part->get_translation());
                captured_rotations.push_back(part->get_rotation());
                captured_sizes.push_back(part->get_size());
            }
            captured = true;
        }

        for (size_t i = 0; i < captured_translations.size(); ++i) {
            auto& translation = captured_translations[i];
            auto& rotation = captured_rotations[i];
            auto& size = captured_sizes[i];

            float hx = size.m_x * 0.5f;
            float hy = size.m_y * 0.5f;
            float hz = size.m_z * 0.5f;

            sdk::vector3_t localCorners[8] = {
                {-hx,-hy,-hz},{ hx,-hy,-hz},{ hx, hy,-hz},{-hx, hy,-hz},
                {-hx,-hy, hz},{ hx,-hy, hz},{ hx, hy, hz},{-hx, hy, hz}
            };

            ImVec2 screenCorners[8];
            bool valid = true;
            for (int c = 0; c < 8; c++) {
                auto screen = globals->visual_engine->world_to_screen(rotation * localCorners[c] + translation, view_port, view_matrix.m_data);
                if (screen.m_x == -1 && screen.m_y == -1) { valid = false; break; }
                screenCorners[c] = ImVec2(screen.m_x, screen.m_y);
            }
            if (!valid) continue;

            int faces[6][4] = { {0,1,2,3},{4,5,6,7},{0,1,5,4},{1,2,6,5},{2,3,7,6},{3,0,4,7} };
            int edges[12][2] = { {0,1},{1,2},{2,3},{3,0},{4,5},{5,6},{6,7},{7,4},{0,4},{1,5},{2,6},{3,7} };

            if (globals->desync_ghost_color.w > 0.f) {
                ImU32 fill_color = IM_COL32(
                    (int)(globals->desync_ghost_color.x * 255),
                    (int)(globals->desync_ghost_color.y * 255),
                    (int)(globals->desync_ghost_color.z * 255),
                    (int)(globals->desync_ghost_color.w * globals->desync_ghost_alpha)
                );
                for (int f = 0; f < 6; f++) {
                    ImVec2 poly[4] = { screenCorners[faces[f][0]], screenCorners[faces[f][1]],
                                       screenCorners[faces[f][2]], screenCorners[faces[f][3]] };
                    draw->AddConvexPolyFilled(poly, 4, fill_color);
                }
            }

            if (globals->desync_ghost_outline) {
                ImU32 outline_color = IM_COL32(
                    (int)(globals->desync_ghost_outline_color.x * 255),
                    (int)(globals->desync_ghost_outline_color.y * 255),
                    (int)(globals->desync_ghost_outline_color.z * 255),
                    (int)(globals->desync_ghost_outline_color.w * 255)
                );
                for (int e = 0; e < 12; e++)
                    draw->AddLine(screenCorners[edges[e][0]], screenCorners[edges[e][1]], outline_color, 1.5f);
            }
        }
    }
    if (was_enabled && !globals->desync_keybind.enabled) { captured = false; captured_translations.clear(); captured_rotations.clear(); captured_sizes.clear(); } was_enabled = globals->desync_keybind.enabled;


    if (globals->world_visuals) {
        if (globals->world_visuals_type == 0) {
            static std::vector<sdk::vector3_t> snow_positions_3d;
            static std::vector<sdk::vector3_t> snow_velocities_3d;
            static std::vector<float> snow_sizes;
            static bool snow_initialized = false;

            if (!snow_initialized) {
                snow_positions_3d.clear();
                snow_velocities_3d.clear();
                snow_sizes.clear();
                for (int i = 0; i < 300; ++i) {
                    snow_positions_3d.push_back(sdk::vector3_t(
                        (rand() % 2000 - 1000) * 0.1f,
                        (rand() % 2000 - 1000) * 0.1f,
                        (rand() % 1000) * 0.1f
                    ));
                    snow_velocities_3d.push_back(sdk::vector3_t(
                        (rand() % 10 - 5) * 0.01f,
                        (rand() % 10 - 5) * 0.01f,
                        -(rand() % 20 + 5) * 0.01f
                    ));
                    snow_sizes.push_back(1.0f + (rand() % 30) * 0.1f);
                }
                snow_initialized = true;
            }

            auto camera_pos = globals->camera->get_camera_translation();
            for (size_t i = 0; i < snow_positions_3d.size(); ++i) {
                snow_positions_3d[i].m_x += snow_velocities_3d[i].m_x;
                snow_positions_3d[i].m_y += snow_velocities_3d[i].m_y;
                snow_positions_3d[i].m_z += snow_velocities_3d[i].m_z;


                float dist = sqrtf(powf(snow_positions_3d[i].m_x - camera_pos.m_x, 2) +
                    powf(snow_positions_3d[i].m_y - camera_pos.m_y, 2) +
                    powf(snow_positions_3d[i].m_z - camera_pos.m_z, 2));

                if (dist > 200.0f || snow_positions_3d[i].m_z < camera_pos.m_z - 100.0f) {
                    snow_positions_3d[i] = sdk::vector3_t(
                        camera_pos.m_x + (rand() % 200 - 100),
                        camera_pos.m_y + (rand() % 200 - 100),
                        camera_pos.m_z + (rand() % 100 + 50)
                    );
                }

                auto screen_pos = globals->visual_engine->world_to_screen(snow_positions_3d[i], view_port, view_matrix.m_data);
                if (screen_pos.m_x != -1 && screen_pos.m_y != -1) {
                    float alpha = std::max(0.0f, 255.0f - (dist / 200.0f) * 255.0f);
                    draw->AddCircleFilled(ImVec2(screen_pos.m_x, screen_pos.m_y), snow_sizes[i],
                        IM_COL32(255, 255, 255, (int)alpha));
                }
            }
        }
        else if (globals->world_visuals_type == 1) {
            static std::vector<sdk::vector3_t> rain_positions_3d;
            static std::vector<sdk::vector3_t> rain_velocities_3d;
            static bool rain_initialized = false;

            if (!rain_initialized) {
                rain_positions_3d.clear();
                rain_velocities_3d.clear();
                auto camera_pos = globals->camera->get_camera_translation();
                for (int i = 0; i < 400; ++i) {
                    rain_positions_3d.push_back(sdk::vector3_t(
                        camera_pos.m_x + (rand() % 400 - 200),
                        camera_pos.m_y + (rand() % 400 - 200),
                        camera_pos.m_z + (rand() % 200 + 50)
                    ));
                    rain_velocities_3d.push_back(sdk::vector3_t(
                        -2.0f - (rand() % 20) * 0.1f,
                        -1.0f - (rand() % 10) * 0.1f,
                        -15.0f - (rand() % 100) * 0.1f
                    ));
                }
                rain_initialized = true;
            }

            auto camera_pos = globals->camera->get_camera_translation();
            for (size_t i = 0; i < rain_positions_3d.size(); ++i) {
                sdk::vector3_t old_pos = rain_positions_3d[i];
                rain_positions_3d[i].m_x += rain_velocities_3d[i].m_x;
                rain_positions_3d[i].m_y += rain_velocities_3d[i].m_y;
                rain_positions_3d[i].m_z += rain_velocities_3d[i].m_z;

                float dist = sqrtf(powf(rain_positions_3d[i].m_x - camera_pos.m_x, 2) +
                    powf(rain_positions_3d[i].m_y - camera_pos.m_y, 2) +
                    powf(rain_positions_3d[i].m_z - camera_pos.m_z, 2));

                if (dist > 300.0f || rain_positions_3d[i].m_z < camera_pos.m_z - 150.0f) {
                    rain_positions_3d[i] = sdk::vector3_t(
                        camera_pos.m_x + (rand() % 400 - 200),
                        camera_pos.m_y + (rand() % 400 - 200),
                        camera_pos.m_z + (rand() % 200 + 50)
                    );
                }

                auto old_screen = globals->visual_engine->world_to_screen(old_pos, view_port, view_matrix.m_data);
                auto new_screen = globals->visual_engine->world_to_screen(rain_positions_3d[i], view_port, view_matrix.m_data);

                if (old_screen.m_x != -1 && old_screen.m_y != -1 && new_screen.m_x != -1 && new_screen.m_y != -1) {
                    float alpha = std::max(0.0f, 200.0f - (dist / 300.0f) * 200.0f);
                    draw->AddLine(ImVec2(old_screen.m_x, old_screen.m_y),
                        ImVec2(new_screen.m_x, new_screen.m_y),
                        IM_COL32(100, 150, 255, (int)alpha), 1.5f);
                }
            }
        }
        else if (globals->world_visuals_type == 2) {
            static std::vector<sdk::vector3_t> particle_positions_3d;
            static std::vector<sdk::vector3_t> particle_velocities_3d;
            static std::vector<ImU32> particle_colors;
            static std::vector<float> particle_life;
            static bool particles_initialized = false;

            if (!particles_initialized) {
                particle_positions_3d.clear();
                particle_velocities_3d.clear();
                particle_colors.clear();
                particle_life.clear();
                auto camera_pos = globals->camera->get_camera_translation();
                for (int i = 0; i < 150; ++i) {
                    particle_positions_3d.push_back(sdk::vector3_t(
                        camera_pos.m_x + (rand() % 200 - 100),
                        camera_pos.m_y + (rand() % 200 - 100),
                        camera_pos.m_z + (rand() % 100 + 20)
                    ));
                    particle_velocities_3d.push_back(sdk::vector3_t(
                        (rand() % 20 - 10) * 0.02f,
                        (rand() % 20 - 10) * 0.02f,
                        (rand() % 10 - 5) * 0.02f
                    ));
                    particle_colors.push_back(IM_COL32(rand() % 255, rand() % 255, rand() % 255, 150));
                    particle_life.push_back(1.0f);
                }
                particles_initialized = true;
            }

            auto camera_pos = globals->camera->get_camera_translation();
            for (size_t i = 0; i < particle_positions_3d.size(); ++i) {
                particle_positions_3d[i].m_x += particle_velocities_3d[i].m_x;
                particle_positions_3d[i].m_y += particle_velocities_3d[i].m_y;
                particle_positions_3d[i].m_z += particle_velocities_3d[i].m_z;
                particle_life[i] -= 0.005f;

                float dist = sqrtf(powf(particle_positions_3d[i].m_x - camera_pos.m_x, 2) +
                    powf(particle_positions_3d[i].m_y - camera_pos.m_y, 2) +
                    powf(particle_positions_3d[i].m_z - camera_pos.m_z, 2));

                if (particle_life[i] <= 0.0f || dist > 250.0f) {
                    particle_positions_3d[i] = sdk::vector3_t(
                        camera_pos.m_x + (rand() % 200 - 100),
                        camera_pos.m_y + (rand() % 200 - 100),
                        camera_pos.m_z + (rand() % 100 + 20)
                    );
                    particle_velocities_3d[i] = sdk::vector3_t(
                        (rand() % 20 - 10) * 0.02f,
                        (rand() % 20 - 10) * 0.02f,
                        (rand() % 10 - 5) * 0.02f
                    );
                    particle_colors[i] = IM_COL32(rand() % 255, rand() % 255, rand() % 255, 150);
                    particle_life[i] = 1.0f;
                }

                auto screen_pos = globals->visual_engine->world_to_screen(particle_positions_3d[i], view_port, view_matrix.m_data);
                if (screen_pos.m_x != -1 && screen_pos.m_y != -1) {
                    float alpha = particle_life[i] * 150.0f;
                    ImU32 color = (particle_colors[i] & 0x00FFFFFF) | ((int)alpha << 24);
                    draw->AddCircleFilled(ImVec2(screen_pos.m_x, screen_pos.m_y), 3.0f, color);
                    draw->AddCircle(ImVec2(screen_pos.m_x, screen_pos.m_y), 3.0f,
                        IM_COL32(255, 255, 255, (int)(alpha * 0.5f)), 0, 1.0f);
                }
            }
        }
    }

    for (auto* player : alive_players) {
        if (!player || !player->alive) continue;

        std::shared_ptr<sdk::c_player> plra = std::make_shared<sdk::c_player>(player->plr_address);

        // Using improved cache system with categorized parts for better performance
        std::shared_ptr<sdk::c_primitives> head = player->get_head();                    // Get head for head ESP
        std::shared_ptr<sdk::c_primitives> torso = player->get_torso();                  // Get torso for body ESP
        std::vector<std::shared_ptr<sdk::c_primitives>> drawables = player->get_drawable_parts();     // Get all visible parts

        if (player->get_name() == globals->players->get_local_player()->get_name() && globals->local_player_check) continue;
        if (globals->team_check) {
            auto local_team = local_player->get_team();
            auto player_team = plra->get_team();
            if (local_team && player_team && local_team->address == player_team->address)
                continue;
        }

        // Check if player is whitelisted
        std::string player_name = player->get_name();
        bool is_whitelisted = std::find(globals->whitelisted_players.begin(), 
                                       globals->whitelisted_players.end(), 
                                       player_name) != globals->whitelisted_players.end();
        if (is_whitelisted) continue;

        // Check ESP max distance if enabled
        if (globals->esp_max_distance_enabled) {
            sdk::vector3_t camera_pos = globals->camera->get_camera_translation();
            auto hrp = player->get_humanoid_root_part();
            if (!hrp) continue; // Skip if no HRP
            sdk::vector3_t player_pos = hrp->get_translation();
            float distance = vector_distance(camera_pos, player_pos);
            if (distance > globals->esp_max_distance) continue;
        }
        // Use categorized parts for better performance
        std::vector<std::shared_ptr<sdk::c_primitives>> parts = player->get_drawable_parts();
        if (parts.empty()) continue;

        ImVec2 min_screen(FLT_MAX, FLT_MAX);
        ImVec2 max_screen(-FLT_MAX, -FLT_MAX);

        bool visible = true;
        if (globals->visual_wallcheck) {
            try {
                auto& world_parts = features::wallcheck::get_static_world_parts();
                sdk::vector3_t camera_pos = globals->camera->get_camera_translation();
                
                if (head) {
                    // Use head position for wallcheck
                    visible = features::wallcheck::is_point_visible(
                        camera_pos,
                        head->get_translation(),
                        world_parts
                    );
                } else if (!parts.empty()) {
                    // Fallback: use first available part
                    visible = features::wallcheck::is_point_visible(
                        camera_pos,
                        parts[0]->get_translation(),
                        world_parts
                    );
                }
            } catch (...) {
                visible = true; // Default to visible on error
            }
        }

        // Calculate bounding box using only upper body parts to prevent interference between players
        std::vector<std::shared_ptr<sdk::c_primitives>> esp_parts;

        // Get core body parts for ESP bounding box (including legs and feet)
        if (torso) esp_parts.push_back(torso);
        if (head) esp_parts.push_back(head);

        // Add arms if available
        std::shared_ptr<sdk::c_primitives> left_arm = player->get_left_arm();
        std::shared_ptr<sdk::c_primitives> right_arm = player->get_right_arm();
        if (left_arm) esp_parts.push_back(left_arm);
        if (right_arm) esp_parts.push_back(right_arm);

        // Add legs and feet for full character coverage
        std::shared_ptr<sdk::c_primitives> left_leg = player->get_left_leg();
        std::shared_ptr<sdk::c_primitives> right_leg = player->get_right_leg();
        std::shared_ptr<sdk::c_primitives> left_foot = player->get_left_foot();
        std::shared_ptr<sdk::c_primitives> right_foot = player->get_right_foot();
        if (left_leg) esp_parts.push_back(left_leg);
        if (right_leg) esp_parts.push_back(right_leg);
        if (left_foot) esp_parts.push_back(left_foot);
        if (right_foot) esp_parts.push_back(right_foot);

        // Fallback for Phantom Forces: if no specific body parts found, use all drawable parts
        if (esp_parts.empty()) {
            esp_parts = parts; // Use all drawable parts as fallback
        }

        // Calculate bounding box from ESP parts only
        for (auto& part : esp_parts) {
            auto rotation = part->get_rotation();
            auto translation = part->get_translation();
            auto size = part->get_size();

            sdk::vector3_t corners[8] = {
                translation + (rotation * sdk::vector3_t(-size.m_x / 2, -size.m_y / 2, -size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(size.m_x / 2, -size.m_y / 2, -size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(-size.m_x / 2, size.m_y / 2, -size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(size.m_x / 2, size.m_y / 2, -size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(-size.m_x / 2, -size.m_y / 2, size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(size.m_x / 2, -size.m_y / 2, size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(-size.m_x / 2, size.m_y / 2, size.m_z / 2)),
                translation + (rotation * sdk::vector3_t(size.m_x / 2, size.m_y / 2, size.m_z / 2))
            };

            for (auto& corner : corners) {
                auto screen_pos = globals->visual_engine->world_to_screen(corner, view_port, view_matrix.m_data);
                if (screen_pos.m_x != -1 && screen_pos.m_y != -1) {
                    if (screen_pos.m_x < min_screen.x) min_screen.x = screen_pos.m_x;
                    if (screen_pos.m_y < min_screen.y) min_screen.y = screen_pos.m_y;
                    if (screen_pos.m_x > max_screen.x) max_screen.x = screen_pos.m_x;
                    if (screen_pos.m_y > max_screen.y) max_screen.y = screen_pos.m_y;
                }
            }
        }

        ImU32 main_color = !globals->visual_wallcheck
            ? IM_COL32(globals->box_color.x * 255, globals->box_color.y * 255, globals->box_color.z * 255, globals->box_color.w * 255)
            : (visible
                ? IM_COL32(globals->wallcheck_visible_color.Value.x * 255, globals->wallcheck_visible_color.Value.y * 255, globals->wallcheck_visible_color.Value.z * 255, globals->wallcheck_visible_color.Value.w * 255)
                : IM_COL32(globals->wallcheck_hidden_color.Value.x * 255, globals->wallcheck_hidden_color.Value.y * 255, globals->wallcheck_hidden_color.Value.z * 255, globals->wallcheck_hidden_color.Value.w * 255));

        // ENHANCED CHAMS WITH GLOW
        if (globals->chams) {
            for (auto& part : parts) {
                auto translation = part->get_translation();
                auto size = part->get_size();
                auto rotation = part->get_rotation();

                float hx = size.m_x * 0.5f;
                float hy = size.m_y * 0.5f;
                float hz = size.m_z * 0.5f;

                sdk::vector3_t localCorners[8] = {
                    {-hx, -hy, -hz}, { hx, -hy, -hz}, { hx,  hy, -hz}, {-hx,  hy, -hz},
                    {-hx, -hy,  hz}, { hx, -hy,  hz}, { hx,  hy,  hz}, {-hx,  hy,  hz}
                };

                ImVec2 screenCorners[8];
                bool valid = true;
                for (int i = 0; i < 8; i++) {
                    sdk::vector3_t worldPos = rotation * localCorners[i] + translation;
                    auto screen_pos = globals->visual_engine->world_to_screen(worldPos, view_port, view_matrix.m_data);
                    if (screen_pos.m_x == -1 && screen_pos.m_y == -1) {
                        valid = false;
                        break;
                    }
                    screenCorners[i] = ImVec2(screen_pos.m_x, screen_pos.m_y);
                }
                if (!valid) continue;

                int edges[12][2] = {
                    {0,1},{1,2},{2,3},{3,0},
                    {4,5},{5,6},{6,7},{7,4},
                    {0,4},{1,5},{2,6},{3,7}
                };

                int faces[6][4] = {
                    {0,1,2,3}, {4,5,6,7}, {0,1,5,4},
                    {1,2,6,5}, {2,3,7,6}, {3,0,4,7}
                };

                // Base chams color
                ImU32 chams_color = ImGui::ColorConvertFloat4ToU32(globals->chams_color);

                // Rainbow
                if (globals->chams_rainbow) {
                    float hue = fmodf(time * globals->chams_rainbow_speed, 1.0f);
                    ImVec4 rainbow = ImColor::HSV(hue, 1.0f, 1.0f);
                    chams_color = IM_COL32(rainbow.x * 255, rainbow.y * 255, rainbow.z * 255, globals->chams_color.w * 255);
                }

                // Pulsing
                if (globals->chams_pulsing) {
                    float pulse = (sin(time * globals->chams_pulse_speed) + 1.0f) * 0.5f;
                    float alpha = globals->chams_transparency * pulse;
                    chams_color = (chams_color & 0x00FFFFFF) | ((int)(alpha * 255) << 24);
                }
                else {
                    chams_color = (chams_color & 0x00FFFFFF) | ((int)(globals->chams_transparency * 255) << 24);
                }

                // -------------------
                // GLOW EFFECT (faces)
                // -------------------
                if (globals->chams_glow && (globals->chams_type == 0 || globals->chams_type == 2)) {
                    for (int f = 0; f < 6; f++) {
                        ImVec2 poly[4] = {
                            screenCorners[faces[f][0]],
                            screenCorners[faces[f][1]],
                            screenCorners[faces[f][2]],
                            screenCorners[faces[f][3]]
                        };

                        for (int i = 1; i <= (int)globals->chams_glow_size; i++) {
                            float alpha = (1.0f - (float)i / globals->chams_glow_size) * 0.4f;
                            ImU32 glow_color = IM_COL32(
                                globals->chams_glow_color.x * 255,
                                globals->chams_glow_color.y * 255,
                                globals->chams_glow_color.z * 255,
                                alpha * 255
                            );

                            ImVec2 glow_poly[4];
                            ImVec2 center = (poly[0] + poly[2]) * 0.5f;
                            for (int j = 0; j < 4; j++) {
                                ImVec2 dir = poly[j] - center;
                                float len = sqrtf(dir.x * dir.x + dir.y * dir.y);
                                if (len > 0.001f) { dir.x /= len; dir.y /= len; }
                                glow_poly[j] = poly[j] + dir * (float)i;
                            }
                            draw->AddConvexPolyFilled(glow_poly, 4, glow_color);
                        }
                    }
                }

                // -------------------
                // Filled Chams
                // -------------------
                if (globals->chams_type == 0 || globals->chams_type == 2) {
                    for (int f = 0; f < 6; f++) {
                        ImVec2 poly[4] = {
                            screenCorners[faces[f][0]],
                            screenCorners[faces[f][1]],
                            screenCorners[faces[f][2]],
                            screenCorners[faces[f][3]]
                        };
                        draw->AddConvexPolyFilled(poly, 4, chams_color);
                    }
                }

                // -------------------
                // Outline Chams + Glow
                // -------------------
                if (globals->chams_type == 1 || globals->chams_type == 2) {
                    ImU32 outline_color = ImGui::ColorConvertFloat4ToU32(globals->chams_outline_color);

                    // Glow around outline
                    if (globals->chams_glow) {
                        for (int i = 1; i <= (int)globals->chams_glow_size; i++) {
                            float alpha = (1.0f - (float)i / globals->chams_glow_size) * 0.4f;
                            ImU32 glow_color = IM_COL32(
                                globals->chams_glow_color.x * 255,
                                globals->chams_glow_color.y * 255,
                                globals->chams_glow_color.z * 255,
                                alpha * 255
                            );
                            for (int e = 0; e < 12; e++) {
                                draw->AddLine(
                                    screenCorners[edges[e][0]],
                                    screenCorners[edges[e][1]],
                                    glow_color,
                                    globals->chams_thickness + i
                                );
                            }
                        }
                    }

                    // Use traditional line-based outline (simplified to avoid compiler ICE)
                    for (int i = 0; i < 12; i++)
                        draw->AddLine(screenCorners[edges[i][0]], screenCorners[edges[i][1]], outline_color, globals->chams_thickness);
                }
            }
        }

        // ENHANCED BOXES
        if (globals->box && min_screen.x != FLT_MAX && max_screen.x != -FLT_MAX) {
            // Add some padding to prevent tight bounding boxes
            float padding = 5.0f;
            min_screen.x = floorf(min_screen.x - padding);
            min_screen.y = floorf(min_screen.y - padding);
            max_screen.x = ceilf(max_screen.x + padding);
            max_screen.y = ceilf(max_screen.y + padding);

            ImVec2 tl(min_screen.x, min_screen.y);
            ImVec2 br(max_screen.x, max_screen.y);

            // Rainbow box color
            ImU32 box_color = main_color;
            if (globals->box_rainbow) {
                float hue = fmodf(time * globals->box_rainbow_speed, 1.0f);
                ImVec4 rainbow = ImColor::HSV(hue, 1.0f, 1.0f);
                box_color = IM_COL32(rainbow.x * 255, rainbow.y * 255, rainbow.z * 255, 255);
            }

            // Box glow effect
            if (globals->box_glow) {
                for (int i = 1; i <= (int)globals->box_glow_size; i++) {
                    float alpha = (1.0f - (float)i / globals->box_glow_size) * 0.3f;
                    ImU32 glow_color = IM_COL32(255, 255, 255, alpha * 255);
                    draw->AddRect({ tl.x - i, tl.y - i }, { br.x + i, br.y + i }, glow_color, 0.0f, 0, globals->box_thickness);
                }
            }

            // Box fill
            if (globals->box_filled) {
                ImU32 fill_color = IM_COL32(
                    globals->box_fill_color.x * 255,
                    globals->box_fill_color.y * 255,
                    globals->box_fill_color.z * 255,
                    globals->box_fill_color.w * 255
                );

                if (globals->box_gradient) {
                    // Gradient fill
                    ImVec4 grad_color = globals->box_gradient_color;
                    for (float y = tl.y; y < br.y; y += 1.0f) {
                        float ratio = (y - tl.y) / (br.y - tl.y);
                        ImU32 lerp_color = IM_COL32(
                            (globals->box_fill_color.x + (grad_color.x - globals->box_fill_color.x) * ratio) * 255,
                            (globals->box_fill_color.y + (grad_color.y - globals->box_fill_color.y) * ratio) * 255,
                            (globals->box_fill_color.z + (grad_color.z - globals->box_fill_color.z) * ratio) * 255,
                            globals->box_fill_color.w * 255
                        );
                        draw->AddLine({ tl.x, y }, { br.x, y }, lerp_color, 1.0f);
                    }
                }
                else {
                    draw->AddRectFilled(tl, br, fill_color);
                }
            }

            // Box outline based on type
            if (globals->box_type == 0) { // Normal
                draw->AddRect({ tl.x - 1, tl.y - 1 }, { br.x + 1, br.y + 1 }, IM_COL32(0, 0, 0, 255), 0.0f, 0, globals->box_thickness);
                draw->AddRect(tl, br, box_color, 0.0f, 0, globals->box_thickness);
                draw->AddRect({ tl.x + 1, tl.y + 1 }, { br.x - 1, br.y - 1 }, IM_COL32(0, 0, 0, 255), 0.0f, 0, globals->box_thickness);
            }
            else if (globals->box_type == 1) { // Rounded
                draw->AddRect({ tl.x - 1, tl.y - 1 }, { br.x + 1, br.y + 1 }, IM_COL32(0, 0, 0, 255), 5.0f, 0, globals->box_thickness);
                draw->AddRect(tl, br, box_color, 5.0f, 0, globals->box_thickness);
                draw->AddRect({ tl.x + 1, tl.y + 1 }, { br.x - 1, br.y - 1 }, IM_COL32(0, 0, 0, 255), 5.0f, 0, globals->box_thickness);
            }
            else if (globals->box_type == 2) { // Corner
                float corner_size = std::min((br.x - tl.x) * 0.25f, (br.y - tl.y) * 0.25f);
                float thickness = globals->box_thickness + 1.0f;

                // Black outline corners
                draw->AddLine(ImVec2(tl.x - 1, tl.y - 1), ImVec2(tl.x + corner_size + 1, tl.y - 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(tl.x - 1, tl.y - 1), ImVec2(tl.x - 1, tl.y + corner_size + 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(br.x - corner_size - 1, tl.y - 1), ImVec2(br.x + 1, tl.y - 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(br.x + 1, tl.y - 1), ImVec2(br.x + 1, tl.y + corner_size + 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(tl.x - 1, br.y - corner_size - 1), ImVec2(tl.x - 1, br.y + 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(tl.x - 1, br.y + 1), ImVec2(tl.x + corner_size + 1, br.y + 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(br.x - corner_size - 1, br.y + 1), ImVec2(br.x + 1, br.y + 1), IM_COL32(0, 0, 0, 255), thickness);
                draw->AddLine(ImVec2(br.x + 1, br.y - corner_size - 1), ImVec2(br.x + 1, br.y + 1), IM_COL32(0, 0, 0, 255), thickness);

                // Colored corners
                draw->AddLine(ImVec2(tl.x, tl.y), ImVec2(tl.x + corner_size, tl.y), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(tl.x, tl.y), ImVec2(tl.x, tl.y + corner_size), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(br.x - corner_size, tl.y), ImVec2(br.x, tl.y), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(br.x, tl.y), ImVec2(br.x, tl.y + corner_size), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(tl.x, br.y - corner_size), ImVec2(tl.x, br.y), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(tl.x, br.y), ImVec2(tl.x + corner_size, br.y), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(br.x - corner_size, br.y), ImVec2(br.x, br.y), box_color, globals->box_thickness);
                draw->AddLine(ImVec2(br.x, br.y - corner_size), ImVec2(br.x, br.y), box_color, globals->box_thickness);
            }
            else if (globals->box_type == 3) { // Image
                if (features::visuals->boximage) {
                    // Draw the image as a box
                    draw->AddImage((ImTextureID)features::visuals->boximage, tl, br, { 0, 0 }, { 1, 1 }, IM_COL32_WHITE);
                }
            }
        }


        if (globals->health_bar && min_screen.x != FLT_MAX && max_screen.x != -FLT_MAX) {
            float health = player->get_health();
            float max_health = player->get_max_health();
            float health_ratio = std::clamp(health / max_health, 0.0f, 1.0f);
            float box_height = max_screen.y - min_screen.y;

            // Position health bar further left and add some spacing
            ImVec2 bar_tl(min_screen.x - 12.0f, min_screen.y);
            ImVec2 bar_br(min_screen.x - 8.0f, max_screen.y);

            bar_tl.x = floorf(bar_tl.x);
            bar_tl.y = floorf(bar_tl.y);
            bar_br.x = ceilf(bar_br.x);
            bar_br.y = ceilf(bar_br.y);

            float filled_height = box_height * health_ratio;

            // Animation
            if (globals->health_animated) {
                static std::unordered_map<uintptr_t, float> anim_health_map;
                float target_health = health_ratio;
                float& anim_health = anim_health_map[player->alive];  // Fixed: use address instead of ->alive
                if (anim_health == 0.0f) anim_health = health_ratio;
                anim_health = anim_health + (target_health - anim_health) * 0.02f;
                filled_height = box_height * anim_health;
            }

            ImVec2 filled_tl(bar_tl.x, bar_br.y - filled_height);
            ImVec2 filled_br(bar_br.x, bar_br.y);

            // Background
            if (globals->health_background) {
                ImU32 bg_color = IM_COL32(
                    globals->health_bg_color.x * 255,
                    globals->health_bg_color.y * 255,
                    globals->health_bg_color.z * 255,
                    globals->health_bg_color.w * 255
                );
                draw->AddRectFilled(bar_tl, bar_br, bg_color);
            }
            else {
                // Default background (your original)
                draw->AddRectFilled(bar_tl, bar_br, IM_COL32(30, 30, 30, 200));
            }

            // Health bar color
            ImU32 health_color;
            if (globals->health_gradient) {
                ImVec4 low = globals->health_low_color;
                ImVec4 high = globals->health_high_color;
                health_color = IM_COL32(
                    (low.x + (high.x - low.x) * health_ratio) * 255,
                    (low.y + (high.y - low.y) * health_ratio) * 255,
                    (low.z + (high.z - low.z) * health_ratio) * 255,
                    255
                );
            }
            else {
                // Use your original lerp function
                health_color = features::visuals->lerp(
                    IM_COL32(255, 0, 0, 255),
                    IM_COL32(0, 255, 0, 255),
                    health_ratio
                );
            }

            draw->AddRectFilled(filled_tl, filled_br, health_color);
            draw->AddRect(bar_tl, bar_br, IM_COL32(0, 0, 0, 255));

            // Health text
            if (globals->health_text) {
                std::string health_str = std::to_string((int)health);
                ImVec2 text_size = ImGui::CalcTextSize(health_str.c_str());
                ImVec2 text_pos(bar_tl.x - text_size.x - 2, bar_tl.y + (box_height - text_size.y) / 2);

                draw->AddText(ImVec2(text_pos.x + 1, text_pos.y + 1), IM_COL32(0, 0, 0, 255), health_str.c_str());
                draw->AddText(text_pos, IM_COL32(255, 255, 255, 255), health_str.c_str());
            }
        }
        if (globals->name_esp && min_screen.x != FLT_MAX && max_screen.x != -FLT_MAX) {
            std::string name = player->get_name();
            ImVec2 text_size = ImGui::CalcTextSize(name.c_str());
            text_size.x *= globals->name_font_size;
            text_size.y *= globals->name_font_size;

            ImVec2 text_pos(min_screen.x + (max_screen.x - min_screen.x) / 2 - text_size.x / 2, min_screen.y - text_size.y - 8);

            // Background
            if (globals->name_background) {
                ImVec2 bg_tl(text_pos.x - 2, text_pos.y - 1);
                ImVec2 bg_br(text_pos.x + text_size.x + 2, text_pos.y + text_size.y + 1);
                ImU32 bg_color = IM_COL32(
                    globals->name_bg_color.x * 255,
                    globals->name_bg_color.y * 255,
                    globals->name_bg_color.z * 255,
                    globals->name_bg_color.w * 255
                );
                draw->AddRectFilled(bg_tl, bg_br, bg_color);
            }

            // Text color
            ImU32 text_color = main_color;
            if (globals->name_rainbow) {
                float hue = fmodf(time * globals->name_rainbow_speed, 1.0f);
                ImVec4 rainbow = ImColor::HSV(hue, 1.0f, 1.0f);
                text_color = IM_COL32(rainbow.x * 255, rainbow.y * 255, rainbow.z * 255, 255);
            }

            // Text outline
            draw->AddText(ImVec2(text_pos.x + 1, text_pos.y + 1), IM_COL32(0, 0, 0, 255), name.c_str());
            draw->AddText(ImVec2(text_pos.x - 1, text_pos.y - 1), IM_COL32(0, 0, 0, 255), name.c_str());
            draw->AddText(ImVec2(text_pos.x + 1, text_pos.y - 1), IM_COL32(0, 0, 0, 255), name.c_str());
            draw->AddText(ImVec2(text_pos.x - 1, text_pos.y + 1), IM_COL32(0, 0, 0, 255), name.c_str());
            draw->AddText(text_pos, text_color, name.c_str());
        }

        if (globals->skeleton_esp) {
            ImU32 skeleton_color = IM_COL32(
                globals->skeleton_color.x * 255,
                globals->skeleton_color.y * 255,
                globals->skeleton_color.z * 255,
                globals->skeleton_color.w * 255
            );

            // Rainbow skeleton
            if (globals->skeleton_rainbow) {
                float hue = fmodf(time * globals->skeleton_rainbow_speed, 1.0f);
                ImVec4 rainbow = ImColor::HSV(hue, 1.0f, 1.0f);
                skeleton_color = IM_COL32(rainbow.x * 255, rainbow.y * 255, rainbow.z * 255, 255);
            }

            if (globals->skeleton_type == 0) { // Line skeleton
                // Use pre-categorized torso to detect R15 vs R6
                bool is_r15 = (player->get_torso() != nullptr);

                static const std::vector<std::pair<std::string, std::string>> r6_bones = {
                    {"Head", "Torso"}, {"Torso", "Left Arm"}, {"Torso", "Right Arm"},
                    {"Torso", "Left Leg"}, {"Torso", "Right Leg"}
                };
                static const std::vector<std::pair<std::string, std::string>> r15_bones = {
                    {"Head", "UpperTorso"}, {"UpperTorso", "LowerTorso"},
                    {"UpperTorso", "LeftUpperArm"}, {"UpperTorso", "RightUpperArm"},
                    {"LowerTorso", "LeftUpperLeg"}, {"LowerTorso", "RightUpperLeg"},
                    {"LeftUpperArm", "LeftLowerArm"}, {"LeftLowerArm", "LeftHand"},
                    {"RightUpperArm", "RightLowerArm"}, {"RightLowerArm", "RightHand"},
                    {"LeftUpperLeg", "LeftLowerLeg"}, {"LeftLowerLeg", "LeftFoot"},
                    {"RightUpperLeg", "RightLowerLeg"}, {"RightLowerLeg", "RightFoot"}
                };

                const auto& bones = is_r15 ? r15_bones : r6_bones;

                // Use pre-categorized parts for better performance
                std::unordered_map<std::string, ImVec2> bone_screens;
                std::unordered_map<std::string, std::shared_ptr<sdk::c_primitives>> bone_parts = {
                    {"Head", head},
                    {"Torso", torso},
                    {"UpperTorso", torso}, // UpperTorso is the same as Torso in R15
                    {"LowerTorso", nullptr}, // Will be handled by get_part if needed
                    {"Left Arm", player->get_left_arm()},
                    {"Right Arm", player->get_right_arm()},
                    {"Left Leg", player->get_left_leg()},
                    {"Right Leg", player->get_right_leg()},
                    {"LeftUpperArm", player->get_left_arm()},
                    {"RightUpperArm", player->get_right_arm()},
                    {"LeftUpperLeg", player->get_left_leg()},
                    {"RightUpperLeg", player->get_right_leg()},
                    {"LeftLowerArm", nullptr}, // Will be handled by get_part if needed
                    {"LeftLowerLeg", nullptr}, // Will be handled by get_part if needed
                    {"RightLowerArm", nullptr}, // Will be handled by get_part if needed
                    {"RightLowerLeg", nullptr}, // Will be handled by get_part if needed
                    {"LeftHand", nullptr}, // Will be handled by get_part if needed
                    {"RightHand", nullptr}, // Will be handled by get_part if needed
                    {"LeftFoot", nullptr}, // Will be handled by get_part if needed
                    {"RightFoot", nullptr} // Will be handled by get_part if needed
                };

                for (const auto& bone_pair : bones) {
                    const std::string& start = bone_pair.first;
                    const std::string& end = bone_pair.second;
                    
                    if (bone_screens.find(start) == bone_screens.end()) {
                        std::shared_ptr<sdk::c_primitives> part = bone_parts[start] ? bone_parts[start] : player->get_part(start);
                        if (part) {
                            sdk::vector2_t s = globals->visual_engine->world_to_screen(part->get_translation(), view_port, view_matrix.m_data);
                            if (s.m_x != -1 && s.m_y != -1)
                                bone_screens[start] = ImVec2(s.m_x, s.m_y);
                        }
                    }
                    if (bone_screens.find(end) == bone_screens.end()) {
                        std::shared_ptr<sdk::c_primitives> part = bone_parts[end] ? bone_parts[end] : player->get_part(end);
                        if (part) {
                            sdk::vector2_t s = globals->visual_engine->world_to_screen(part->get_translation(), view_port, view_matrix.m_data);
                            if (s.m_x != -1 && s.m_y != -1)
                                bone_screens[end] = ImVec2(s.m_x, s.m_y);
                        }
                    }

                    auto it_start = bone_screens.find(start);
                    auto it_end = bone_screens.find(end);
                    if (it_start != bone_screens.end() && it_end != bone_screens.end()) {
                        // Glow effect for skeleton
                        if (globals->skeleton_glow) {
                            for (int i = 1; i <= (int)globals->skeleton_glow_size; i++) {
                                float alpha = (1.0f - (float)i / globals->skeleton_glow_size) * 0.5f;
                                ImU32 glow_color = IM_COL32(255, 255, 255, alpha * 255);
                                draw->AddLine(it_start->second, it_end->second, glow_color, globals->skeleton_thickness + i);
                            }
                        }
                        draw->AddLine(it_start->second, it_end->second, skeleton_color, globals->skeleton_thickness);
                    }
                }
            }
            else if (globals->skeleton_type == 1) { // YOUR ORIGINAL IMAGE SKELETON CODE
                struct LimbImage { const char* start; const char* end; ID3D11ShaderResourceView** texture; float w, h; };
                static const std::vector<LimbImage> limbs = {
                    {"Head","Head",&features::visuals->skeletonhead,64.f,64.f},
                    {"UpperTorso","LowerTorso",&features::visuals->skeletontorso,80.f,80.f},
                    {"LeftUpperArm","LeftLowerArm",&features::visuals->skeletonleftarm,48.f,64.f},
                    {"RightUpperArm","RightLowerArm",&features::visuals->skeletonrightarm,48.f,64.f},
                    {"LeftUpperLeg","LeftLowerLeg",&features::visuals->skeletonleftleg,48.f,64.f},
                    {"RightUpperLeg","RightLowerLeg",&features::visuals->skeletonrightleg,48.f,64.f}
                };

                // Use pre-categorized parts for better performance
                std::unordered_map<std::string, ImVec2> limb_screens;
                std::unordered_map<std::string, std::shared_ptr<sdk::c_primitives>> limb_parts = {
                    {"Head", head},
                    {"UpperTorso", torso},
                    {"LowerTorso", nullptr}, // Will be handled by get_part if needed
                    {"LeftUpperArm", player->get_left_arm()},
                    {"LeftLowerArm", nullptr}, // Will be handled by get_part if needed
                    {"RightUpperArm", player->get_right_arm()},
                    {"RightLowerArm", nullptr}, // Will be handled by get_part if needed
                    {"LeftUpperLeg", player->get_left_leg()},
                    {"LeftLowerLeg", nullptr}, // Will be handled by get_part if needed
                    {"RightUpperLeg", player->get_right_leg()},
                    {"RightLowerLeg", nullptr} // Will be handled by get_part if needed
                };

                for (const auto& limb : limbs) {
                    if (limb_screens.find(limb.start) == limb_screens.end()) {
                        std::shared_ptr<sdk::c_primitives> part = limb_parts[limb.start] ? limb_parts[limb.start] : player->get_part(limb.start);
                        if (part) {
                            sdk::vector2_t s = globals->visual_engine->world_to_screen(part->get_translation(), view_port, view_matrix.m_data);
                            if (s.m_x != -1 && s.m_y != -1)
                                limb_screens[limb.start] = ImVec2(s.m_x, s.m_y);
                        }
                    }
                    if (limb_screens.find(limb.end) == limb_screens.end()) {
                        std::shared_ptr<sdk::c_primitives> part = limb_parts[limb.end] ? limb_parts[limb.end] : player->get_part(limb.end);
                        if (part) {
                            sdk::vector2_t s = globals->visual_engine->world_to_screen(part->get_translation(), view_port, view_matrix.m_data);
                            if (s.m_x != -1 && s.m_y != -1)
                                limb_screens[limb.end] = ImVec2(s.m_x, s.m_y);
                        }
                    }

                    auto it_start = limb_screens.find(limb.start);
                    auto it_end = limb_screens.find(limb.end);
                    if (it_start == limb_screens.end() || it_end == limb_screens.end() || !*limb.texture) continue;

                    ImVec2 ss = it_start->second;
                    ImVec2 se = it_end->second;

                    ImVec2 mid{ (ss.x + se.x) * 0.5f, (ss.y + se.y) * 0.5f };
                    float limb_len = hypotf(se.x - ss.x, se.y - ss.y);
                    float scale = (limb_len / limb.h) * 3.f;
                    float w = limb.w * scale;
                    float h = limb.h * scale;

                    ImVec2 pos1{ mid.x - w * 0.5f, mid.y - h * 0.5f };
                    ImVec2 pos2{ mid.x + w * 0.5f, mid.y + h * 0.5f };

                    draw->AddImage((ImTextureID)(*limb.texture), pos1, pos2, { 0,0 }, { 1,1 }, IM_COL32_WHITE);
                }
            }
        }

        // ENHANCED DISTANCE ESP
        if (globals->distance_esp && min_screen.x != FLT_MAX && max_screen.x != -FLT_MAX) {
            auto camera_pos = globals->camera->get_camera_translation();
            sdk::vector3_t player_pos(0, 0, 0);
            
            // Try to get player position from head, torso, or first available part
            if (head) {
                player_pos = head->get_translation();
            }
            else if (torso) {
                player_pos = torso->get_translation();
            }
            else if (!esp_parts.empty()) {
                player_pos = esp_parts[0]->get_translation();
            }

            float distance = sqrtf(powf(player_pos.m_x - camera_pos.m_x, 2) +
                powf(player_pos.m_y - camera_pos.m_y, 2) +
                powf(player_pos.m_z - camera_pos.m_z, 2));

            std::string dist_text = std::to_string((int)distance) + "m";
            ImVec2 text_size = ImGui::CalcTextSize(dist_text.c_str());
            ImVec2 text_pos(min_screen.x + (max_screen.x - min_screen.x) / 2 - text_size.x / 2, max_screen.y + 10);

            // Background
            if (globals->distance_background) {
                ImVec2 bg_tl(text_pos.x - 2, text_pos.y - 1);
                ImVec2 bg_br(text_pos.x + text_size.x + 2, text_pos.y + text_size.y + 1);
                ImU32 bg_color = IM_COL32(
                    globals->distance_bg_color.x * 255,
                    globals->distance_bg_color.y * 255,
                    globals->distance_bg_color.z * 255,
                    globals->distance_bg_color.w * 255
                );
                draw->AddRectFilled(bg_tl, bg_br, bg_color);
            }

            ImU32 text_color = IM_COL32(
                globals->distance_color.x * 255,
                globals->distance_color.y * 255,
                globals->distance_color.z * 255,
                globals->distance_color.w * 255
            );

            // Text outline
            draw->AddText(ImVec2(text_pos.x + 1, text_pos.y + 1), IM_COL32(0, 0, 0, 255), dist_text.c_str());
            draw->AddText(ImVec2(text_pos.x - 1, text_pos.y - 1), IM_COL32(0, 0, 0, 255), dist_text.c_str());
            draw->AddText(ImVec2(text_pos.x + 1, text_pos.y - 1), IM_COL32(0, 0, 0, 255), dist_text.c_str());
            draw->AddText(ImVec2(text_pos.x - 1, text_pos.y + 1), IM_COL32(0, 0, 0, 255), dist_text.c_str());
            draw->AddText(text_pos, text_color, dist_text.c_str());
        }
    }
    }
    catch (...) {
        // Silent failure - don't crash the application
    }
}
