#pragma once
#include <vector>
#include <memory>
#include <mutex>
#include <atomic>
#include <chrono>
#include <thread>
#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/sdk/classes/c_primitives.hpp>
#include <source/framework/globals/globals.hpp>

namespace features {

    struct Part {
        sdk::vector3_t position;
        sdk::vector3_t size;
        sdk::matrix3_t rotation;
        float volume;
        bool isLarge;
        std::uint64_t address;
        
        Part() : position{0, 0, 0}, size{0, 0, 0}, rotation{}, volume(0.0f), isLarge(false), address(0) {}
        Part(const sdk::vector3_t& pos, const sdk::vector3_t& sz, const sdk::matrix3_t& rot, float vol, bool large, std::uint64_t addr) 
            : position(pos), size(sz), rotation(rot), volume(vol), isLarge(large), address(addr) {}
    };

    class wallcheck {
    public:
        // Constants
        static constexpr float min_partsize = 0.15f;
        static constexpr float ray_depth = 0.8f;
        static constexpr float ray_directory = 1e-6f;
        static constexpr float cache_update_wait = 120.0f; // 2 minutes
        static constexpr size_t max_rays_perframe = 8;
        static constexpr float vis_distance = 500.0f;

        // Cache management
        static std::vector<Part> cached_parts;
        static std::mutex cache_mutex;
        static std::atomic<bool> rebuild_in_progress;
        static std::atomic<bool> has_valid_cache;
        static double last_update;

        // Core functions
        static std::vector<Part>& get_static_world_parts();
        static bool ray_intersects_obb(const sdk::vector3_t& ray_origin, const sdk::vector3_t& ray_dir, const Part& part, float max_dist);
        static bool is_visible(const sdk::vector3_t& from, const sdk::vector3_t& head, const sdk::vector3_t& torso, 
                              const sdk::vector3_t& pelvis, const sdk::vector3_t& left_foot, const sdk::vector3_t& right_foot,
                              const std::vector<Part>& world_parts, std::uint64_t player_id = 0, bool force_check = false);
        static bool is_point_visible(const sdk::vector3_t& from, const sdk::vector3_t& target, const std::vector<Part>& world_parts);
        
        // Utility functions
        static double get_time_seconds();
        static bool is_cache_ready();
        static void force_cache_refresh();
        
        // Map change detection
        static bool detect_map_change();
        static void reset_cache_on_map_change();
        static std::string get_current_map_name();
        static std::uint64_t get_current_map_address();
        
        // Legacy compatibility
        static void rebuild_cache();
        static void update_thread();
    };
}
