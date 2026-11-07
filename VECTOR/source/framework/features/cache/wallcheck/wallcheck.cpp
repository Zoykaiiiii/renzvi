#include "wallcheck.hpp"
#include <thread>
#include <chrono>
#include <algorithm>
#include <cmath>
#include <unordered_set>
#include <cfloat>

// Static member definitions
std::vector<features::Part> features::wallcheck::cached_parts;
std::mutex features::wallcheck::cache_mutex;
std::atomic<bool> features::wallcheck::rebuild_in_progress{false};
std::atomic<bool> features::wallcheck::has_valid_cache{false};
double features::wallcheck::last_update = 0.0;

// Helper functions for matrix operations
namespace {
    sdk::matrix3_t transpose(const sdk::matrix3_t& mat) {
        sdk::matrix3_t result;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                result.m_data[i][j] = mat.m_data[j][i];
            }
        }
        return result;
    }

    sdk::vector3_t multiply(const sdk::matrix3_t& mat, const sdk::vector3_t& vec) {
        return sdk::vector3_t(
            mat.m_data[0][0] * vec.m_x + mat.m_data[0][1] * vec.m_y + mat.m_data[0][2] * vec.m_z,
            mat.m_data[1][0] * vec.m_x + mat.m_data[1][1] * vec.m_y + mat.m_data[1][2] * vec.m_z,
            mat.m_data[2][0] * vec.m_x + mat.m_data[2][1] * vec.m_y + mat.m_data[2][2] * vec.m_z
        );
    }

    float get_component(const sdk::vector3_t& vec, int i) {
        switch (i) {
            case 0: return vec.m_x;
            case 1: return vec.m_y;
            case 2: return vec.m_z;
            default: return 0.0f;
        }
    }

    sdk::vector3_t normalize(const sdk::vector3_t& vec) {
        return vec.normalize();
    }

    float dot_product(const sdk::vector3_t& a, const sdk::vector3_t& b) {
        return a.m_x * b.m_x + a.m_y * b.m_y + a.m_z * b.m_z;
    }

    float magnitude(const sdk::vector3_t& vec) {
        return vec.magnitude();
    }
}

double features::wallcheck::get_time_seconds() {
    using namespace std::chrono;
    return duration_cast<duration<double>>(high_resolution_clock::now().time_since_epoch()).count();
}

bool features::wallcheck::ray_intersects_obb(
    const sdk::vector3_t& ray_origin,
    const sdk::vector3_t& ray_dir,
    const Part& part,
    float max_dist)
{
    try {
        sdk::vector3_t to_part = sdk::vector3_t(
            part.position.m_x - ray_origin.m_x,
            part.position.m_y - ray_origin.m_y,
            part.position.m_z - ray_origin.m_z
        );
        
        float sphere_radius = magnitude(part.size) * 0.866f;
        float dist_sq = dot_product(to_part, to_part);
        float combined = sphere_radius + max_dist;

        if (dist_sq > combined * combined) {
            return false;
        }

        sdk::matrix3_t inv_rot = transpose(part.rotation);
        sdk::vector3_t local_origin = multiply(inv_rot, sdk::vector3_t(
            ray_origin.m_x - part.position.m_x,
            ray_origin.m_y - part.position.m_y,
            ray_origin.m_z - part.position.m_z
        ));
        sdk::vector3_t local_dir = multiply(inv_rot, ray_dir);

        sdk::vector3_t min = sdk::vector3_t(
            -part.size.m_x * 0.5f,
            -part.size.m_y * 0.5f,
            -part.size.m_z * 0.5f
        );
        sdk::vector3_t max = sdk::vector3_t(
            part.size.m_x * 0.5f,
            part.size.m_y * 0.5f,
            part.size.m_z * 0.5f
        );

        float tmin = -FLT_MAX;
        float tmax = FLT_MAX;

        for (int i = 0; i < 3; i++) {
            float o = get_component(local_origin, i);
            float d = get_component(local_dir, i);
            float mn = get_component(min, i);
            float mx = get_component(max, i);

            if (std::abs(d) < ray_directory) {
                if (o < mn || o > mx) return false;
            } else {
                float t1 = (mn - o) / d;
                float t2 = (mx - o) / d;
                if (t1 > t2) std::swap(t1, t2);

                if (t1 > tmin) tmin = t1;
                if (t2 < tmax) tmax = t2;

                if (tmin > tmax) return false;
                if (tmax < 0.0f) return false;
                if (tmin > max_dist) return false;
            }
        }

        return (tmin > 0.0f || tmax > 0.0f) && tmin <= max_dist && tmin <= tmax;
    } catch (...) {
        return false;
    }
}

std::vector<features::Part>& features::wallcheck::get_static_world_parts() {
    static std::vector<Part> cached_parts;
    static double last_update = 0.0;
    static std::atomic<bool> update_in_progress{ false };
    static std::atomic<bool> has_valid_cache{ false };

    // Check for map changes first
    if (detect_map_change()) {
        reset_cache_on_map_change();
        // Reset static variables too
        cached_parts.clear();
        cached_parts.shrink_to_fit();
        has_valid_cache = false;
        update_in_progress = false;
        last_update = 0.0;
    }

    double now = get_time_seconds();

    if ((!has_valid_cache || now - last_update >= cache_update_wait) && !update_in_progress) {
        update_in_progress = true;

        std::thread([&]() {
            try {
                std::vector<Part> new_parts;
                new_parts.reserve(3000);

                std::string classes[] = { "Part", "MeshPart", "UnionOperation", "WedgePart", "CornerWedgePart", "TrussPart" };

                // Get player characters for filtering
                std::vector<std::shared_ptr<sdk::c_instance>> player_characters;
                auto entities = features::cache->get_alive_entities();
                for (auto* entity_ptr : entities) {
                    if (entity_ptr) {
                        auto character = entity_ptr->get_character();
                        if (character && character->address) {
                            player_characters.push_back(character);
                        }
                    }
                }

                size_t total_parts = 0;
                for (auto& cls : classes) {
                    if (!globals->workspace) continue;
                    
                    auto children = globals->workspace->get_children();
                    std::vector<std::shared_ptr<sdk::c_instance>> descendants;
                    
                    // Simple recursive search for descendants of class
                    std::function<void(std::shared_ptr<sdk::c_instance>, int)> find_descendants = 
                        [&](std::shared_ptr<sdk::c_instance> obj, int depth) {
                            if (depth > 50 || !obj || !obj->address) return;
                            
                            try {
                                if (obj->get_class_name() == cls) {
                                    descendants.push_back(obj);
                                }
                                
                                auto obj_children = obj->get_children();
                                for (auto& child : obj_children) {
                                    if (child && child->address) {
                                        find_descendants(child, depth + 1);
                                    }
                                }
                            } catch (...) {
                                // Skip invalid objects
                            }
                        };
                    
                    for (auto& child : children) {
                        if (child && child->address) {
                            find_descendants(child, 0);
                        }
                    }

                    for (auto& child : descendants) {
                        try {
                            // Check if this is a player part
                            bool is_player_part = false;
                            for (auto& character : player_characters) {
                                if (character && character->address) {
                                    // Simple check: if child is descendant of character
                                    auto current = child;
                                    int depth = 0;
                                    while (current && current->address && depth < 20) {
                                        if (current->address == character->address) {
                                            is_player_part = true;
                                            break;
                                        }
                                        current = current->get_parent();
                                        depth++;
                                    }
                                    if (is_player_part) break;
                                }
                            }
                            if (is_player_part) continue;

                            // Check transparency
                            try {
                                float transparency = g_memory->read<float>(child->address + sdk::offsets::basepart::transparency); // Transparency offset
                                if (transparency > 0.9f) continue;
                            } catch (...) {
                                // Skip if we can't read transparency
                            }

                            // Get part data
                            auto prim = std::make_shared<sdk::c_primitives>(child->address);
                            if (!prim || prim->primitive_address() == 0) continue;

                            sdk::vector3_t size = prim->get_size();
                            float volume = size.m_x * size.m_y * size.m_z;

                            if (volume < 0.001f && size.m_x < 0.1f && size.m_y < 0.1f && size.m_z < 0.1f) {
                                continue;
                            }

                            Part p;
                            p.position = prim->get_translation();
                            p.size = size;
                            p.rotation = prim->get_rotation();
                            p.volume = volume;
                            p.isLarge = volume > 10.0f;
                            p.address = child->address;

                            new_parts.push_back(p);
                            total_parts++;
                        } catch (...) {
                            continue;
                        }
                    }
                }

                // Sort parts by size (large parts first)
                std::sort(new_parts.begin(), new_parts.end(), [](const Part& a, const Part& b) {
                    if (a.isLarge != b.isLarge) return a.isLarge;
                    return a.volume > b.volume;
                });

{
    std::lock_guard<std::mutex> lock(cache_mutex);
                    cached_parts = std::move(new_parts);
                }
                
                last_update = get_time_seconds();
                has_valid_cache = true;
                update_in_progress = false;

                //printf("[Debug - Wallcheck] Dynamic cache update complete: %zu parts\n", cached_parts.size());
            } catch (...) {
                update_in_progress = false;
            }
        }).detach(); 

      //  printf("[Debug - Wallcheck] Starting Dynamic cache update...\n");
    }

    return cached_parts;
}

bool features::wallcheck::is_visible(
    const sdk::vector3_t& from,
    const sdk::vector3_t& head,
    const sdk::vector3_t& torso,
    const sdk::vector3_t& pelvis,
    const sdk::vector3_t& left_foot,
    const sdk::vector3_t& right_foot,
    const std::vector<Part>& world_parts,
    std::uint64_t player_id,
    bool force_check)
{
    try {
        if (world_parts.empty()) {
            return true;
        }

        float closest_dist = FLT_MAX;
        sdk::vector3_t points[] = { head, torso, pelvis, left_foot, right_foot };
        for (const auto& point : points) {
            float dist = magnitude(sdk::vector3_t(
                point.m_x - from.m_x,
                point.m_y - from.m_y,
                point.m_z - from.m_z
            ));
            if (dist < closest_dist) closest_dist = dist;
        }

        if (closest_dist > vis_distance) {
            return true;
        }

        // Define rays to check
        struct Ray {
            sdk::vector3_t target;
            sdk::vector3_t dir;
            float dist;
            const char* label;
        };

        Ray rays[] = {
            {head, normalize(sdk::vector3_t(head.m_x - from.m_x, head.m_y - from.m_y, head.m_z - from.m_z)), 
             magnitude(sdk::vector3_t(head.m_x - from.m_x, head.m_y - from.m_y, head.m_z - from.m_z)), "HEAD"},
            {torso, normalize(sdk::vector3_t(torso.m_x - from.m_x, torso.m_y - from.m_y, torso.m_z - from.m_z)), 
             magnitude(sdk::vector3_t(torso.m_x - from.m_x, torso.m_y - from.m_y, torso.m_z - from.m_z)), "TORSO"},
            {pelvis, normalize(sdk::vector3_t(pelvis.m_x - from.m_x, pelvis.m_y - from.m_y, pelvis.m_z - from.m_z)), 
             magnitude(sdk::vector3_t(pelvis.m_x - from.m_x, pelvis.m_y - from.m_y, pelvis.m_z - from.m_z)), "PELVIS"},
            {left_foot, normalize(sdk::vector3_t(left_foot.m_x - from.m_x, left_foot.m_y - from.m_y, left_foot.m_z - from.m_z)), 
             magnitude(sdk::vector3_t(left_foot.m_x - from.m_x, left_foot.m_y - from.m_y, left_foot.m_z - from.m_z)), "LFOOT"},
            {right_foot, normalize(sdk::vector3_t(right_foot.m_x - from.m_x, right_foot.m_y - from.m_y, right_foot.m_z - from.m_z)), 
             magnitude(sdk::vector3_t(right_foot.m_x - from.m_x, right_foot.m_y - from.m_y, right_foot.m_z - from.m_z)), "RFOOT"}
        };

        std::sort(std::begin(rays), std::end(rays),
            [](const Ray& a, const Ray& b) { return a.dist < b.dist; });

        int clear_rays = 0;
        int total_checked = 0;

        for (const auto& ray : rays) {
            if (total_checked >= max_rays_perframe) break;

            bool ray_clear = true;
            size_t parts_checked = 0;

            for (const auto& part : world_parts) {
                if (part.volume < 0.01f) continue;

                float part_dist = magnitude(sdk::vector3_t(
                    part.position.m_x - from.m_x,
                    part.position.m_y - from.m_y,
                    part.position.m_z - from.m_z
                ));
                if (part_dist > ray.dist + magnitude(part.size) + 2.0f) continue;

                if (ray_intersects_obb(from, ray.dir, part, ray.dist)) {
                    if (std::abs(part_dist - ray.dist) < ray_depth) {
                        continue;
                    }
                    ray_clear = false;
                break;
                }

                parts_checked++;
                if (parts_checked > 150) break;
            }

            if (ray_clear) {
                clear_rays++;
                if (clear_rays >= 2) return true;
            }

            total_checked++;
        }

        return clear_rays >= 2;
    } catch (...) {
        return true; // Default to visible on error
    }
}

bool features::wallcheck::is_point_visible(
    const sdk::vector3_t& from,
    const sdk::vector3_t& target,
    const std::vector<Part>& world_parts)
{
    try {
        if (world_parts.empty()) {
            return true; 
        }

        sdk::vector3_t dir = normalize(sdk::vector3_t(
            target.m_x - from.m_x,
            target.m_y - from.m_y,
            target.m_z - from.m_z
        ));
        float target_dist = magnitude(sdk::vector3_t(
            target.m_x - from.m_x,
            target.m_y - from.m_y,
            target.m_z - from.m_z
        ));

        if (target_dist > vis_distance) return true;

        for (const auto& part : world_parts) {
            if (!part.isLarge && part.volume < 1.0f) continue;

            if (ray_intersects_obb(from, dir, part, target_dist)) {
                float part_dist = magnitude(sdk::vector3_t(
                    part.position.m_x - from.m_x,
                    part.position.m_y - from.m_y,
                    part.position.m_z - from.m_z
                ));
                if (std::abs(part_dist - target_dist) < 1.5f) continue;
                return false;
            }
        }

        return true;
    } catch (...) {
            return true; 
        }
    }

bool features::wallcheck::is_cache_ready() {
    return has_valid_cache && !cached_parts.empty();
}

void features::wallcheck::force_cache_refresh() {
    last_update = 0.0;
    has_valid_cache = false;
   // printf("[Debug - Wallcheck] Manual cache refresh queued\n");
}

// Legacy compatibility functions
void features::wallcheck::rebuild_cache() {
    force_cache_refresh();
    get_static_world_parts(); // Trigger rebuild
}

void features::wallcheck::update_thread() {
    while (true) {
        try {
            // Check for map changes first
            if (detect_map_change()) {
                reset_cache_on_map_change();
            }
            
            get_static_world_parts(); // This handles the timing internally
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        } catch (...) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        }
    }
}

// Map change detection functions
bool features::wallcheck::detect_map_change() {
    try {
        // Check every 2 seconds to avoid performance impact
        double now = get_time_seconds();
        if (now - globals->last_map_check_time < 2.0) {
            return false;
        }
        globals->last_map_check_time = now;
        
        // Get current workspace
        if (!globals->workspace) {
    return false; 
}

        // Get workspace address as map identifier
        std::uint64_t current_address = globals->workspace->address;
        std::string current_name = globals->workspace->get_name();
        
        // Check if map changed
        if (current_address != globals->current_map_address || 
            current_name != globals->current_map_name) {
            
            globals->current_map_address = current_address;
            globals->current_map_name = current_name;
            globals->map_changed = true;
            
            if (globals->wallcheck_debug_mode) {
                printf("[Wallcheck] Map change detected! New map: %s (0x%llx)\n", 
                       current_name.c_str(), current_address);
            }
            
            return true;
        }
        
        return false;
    } catch (...) {
        return false;
    }
}

void features::wallcheck::reset_cache_on_map_change() {
    try {
        std::lock_guard<std::mutex> lock(cache_mutex);
        
        // Clear all cached data
        cached_parts.clear();
        cached_parts.shrink_to_fit();
        
        // Reset cache state
        has_valid_cache = false;
        rebuild_in_progress = false;
        last_update = 0.0;
        
        // Reset map change flag
        globals->map_changed = false;
        
        if (globals->wallcheck_debug_mode) {
            printf("[Wallcheck] Cache completely reset due to map change\n");
        }
        
    } catch (...) {
        // Silent fail
    }
}

std::string features::wallcheck::get_current_map_name() {
    return globals->current_map_name;
}

std::uint64_t features::wallcheck::get_current_map_address() {
    return globals->current_map_address;
}