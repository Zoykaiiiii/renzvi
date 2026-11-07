#include "triggerbot.hpp"
#include <source/framework/features/cache/cache.hpp>
#include <cmath>
#include <windows.h>

namespace features {
    void c_triggerbot::initialize() {
        try {
            // Initialize triggerbot
        } catch (...) {
            // Silent fail
        }
    }

    void c_triggerbot::update() {
        try {
            if (!globals->triggerbot_enabled) {
                return;
            }

            globals->triggerbot_keybind.Update();
            if (!globals->triggerbot_keybind.enabled) {
                return;
            }

            if (!globals->camera || !globals->workspace) {
                return;
            }

            // Get camera position and rotation
            auto cam_pos = globals->camera->get_camera_translation();
            auto cam_rot = globals->camera->get_camera_rotation();

            // Get local player for self check
            auto local_player = globals->players->get_local_player();
            if (!local_player) {
                return;
            }

            std::string local_name = local_player->get_name();

            // Get all entities
            auto entities = features::cache->get_alive_entities();
            if (entities.empty()) {
                return;
            }

            // Find closest target in FOV
            float closest_distance = FLT_MAX;
            sdk::vector3_t closest_target_pos;

            for (auto* entity_ptr : entities) {
                try {
                    if (!entity_ptr) continue;
                    
                    // Self check - skip local player
                    if (entity_ptr->get_name() == local_name) {
                        continue;
                    }
                    
                    auto head_part = entity_ptr->get_head();
                    if (!head_part) continue;
                    
                    auto target_pos = head_part->get_translation();
                    if (target_pos.m_x == 0 && target_pos.m_y == 0 && target_pos.m_z == 0) {
                        continue;
                    }

                    // Check if target is in FOV
                    if (!is_target_in_fov(target_pos)) {
                        continue;
                    }

                    // 
                    // for triggerbot
                    if (globals->triggerbot_wallcheck) {
                        try {
                            auto& world_parts = features::wallcheck::get_static_world_parts();
                            if (!features::wallcheck::is_point_visible(cam_pos, target_pos, world_parts)) {
                                continue; // Skip this target if not visible
                            }
                        } catch (...) {
                            // Continue if wallcheck fails
                        }
                    }

                    // Calculate distance
                    float distance = std::sqrt(
                        std::pow(target_pos.m_x - cam_pos.m_x, 2) +
                        std::pow(target_pos.m_y - cam_pos.m_y, 2) +
                        std::pow(target_pos.m_z - cam_pos.m_z, 2)
                    );

                    if (distance < closest_distance) {
                        closest_distance = distance;
                        closest_target_pos = target_pos;
                    }
                } catch (...) {
                    continue;
                }
            }

            // If we found a target in FOV, shoot
            if (closest_distance < FLT_MAX) {
                send_click();
            }

        } catch (...) {
            // Silent fail
        }
    }

    bool c_triggerbot::is_target_in_fov(const sdk::vector3_t& target_pos) {
        try {
            if (!globals->camera || !globals->visual_engine) {
                return false;
            }

            auto cam_pos = globals->camera->get_camera_translation();
            auto cam_rot = globals->camera->get_camera_rotation();
            auto view_port = globals->visual_engine->get_view_port();
            auto view_matrix = globals->visual_engine->get_view_matrix();

            // Calculate direction to target
            sdk::vector3_t direction = {
                target_pos.m_x - cam_pos.m_x,
                target_pos.m_y - cam_pos.m_y,
                target_pos.m_z - cam_pos.m_z
            };

            // Normalize direction
            float length = std::sqrt(direction.m_x * direction.m_x + direction.m_y * direction.m_y + direction.m_z * direction.m_z);
            if (length == 0) {
                return false;
            }

            direction.m_x /= length;
            direction.m_y /= length;
            direction.m_z /= length;

            // Get camera forward direction (corrected with negative signs)
            sdk::vector3_t forward = {
                -cam_rot.m_data[0][2],
                -cam_rot.m_data[1][2],
                -cam_rot.m_data[2][2]
            };

            // Calculate dot product
            float dot_product = direction.m_x * forward.m_x + direction.m_y * forward.m_y + direction.m_z * forward.m_z;

            // Only consider targets in front of the player (positive dot product)
            if (dot_product <= 0.0f) {
                return false;
            }

            // Convert FOV to radians and check if target is within FOV
            float fov_radians = (globals->triggerbot_fov / 5.0f) * (3.14159f / 180.0f);
            float cos_fov = std::cos(fov_radians / 2.0f);

            return dot_product >= cos_fov;

        } catch (...) {
            return false;
        }
    }

    void c_triggerbot::send_click() {
        try {
            // Send left mouse button down
            INPUT input_down = {};
            input_down.type = INPUT_MOUSE;
            input_down.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
            SendInput(1, &input_down, sizeof(INPUT));

            // Small delay
            Sleep(10);

            // Send left mouse button up
            INPUT input_up = {};
            input_up.type = INPUT_MOUSE;
            input_up.mi.dwFlags = MOUSEEVENTF_LEFTUP;
            SendInput(1, &input_up, sizeof(INPUT));

        } catch (...) {
            // Silent fail
        }
    }
}
