#pragma once
#include <windows.h>
#include <string>
#include <vector>
#include <memory>
#include <algorithm>
#include <mutex>
#include <thread>
#include <atomic>
#include <chrono>

namespace sdk {
    class c_instance;
    class c_primitives;
}

/**
 * Part categorization enum for better organization and performance
 * This allows for quick access to different types of parts without
 * having to iterate through all parts each time.
 */
enum class e_part_type
{
    hitbox,        // Parts that can be hit (limbs, torso, head) - primary aimbot targets
    accessory,     // Accessories, hats, tools, etc. - visible but not hittable
    other          // Everything else - other drawable parts
};

struct player_part
{
    std::shared_ptr<sdk::c_instance> instance;
    std::shared_ptr<sdk::c_primitives> primitive;
    e_part_type type;
    std::string name;
    std::string class_name;

    player_part() = default;
    player_part(std::shared_ptr<sdk::c_instance> inst, e_part_type part_type = e_part_type::other);
};

struct entity
{
    std::uint64_t plr_address = 0;
    std::uint64_t plr_modelinstance = 0;
    bool alive = false;
    std::vector<player_part> all_parts;  // All parts with categorization

    // Organized part collections for quick access
    std::vector<std::shared_ptr<sdk::c_primitives>> hitbox_parts;      // Head, Torso, Arms, Legs
    std::vector<std::shared_ptr<sdk::c_primitives>> drawable_parts;    // Visible parts for ESP
    std::vector<std::shared_ptr<sdk::c_primitives>> accessory_parts;   // Accessories, hats, etc.

    std::string get_name() const;
    std::shared_ptr<sdk::c_instance> get_character() const;
    std::shared_ptr<sdk::c_primitives> get_part(const std::string& name) const;
    std::shared_ptr<sdk::c_primitives> get_part_by_class(const std::string& class_name) const;

    // Legacy method - returns all drawable parts
    std::vector<std::shared_ptr<sdk::c_primitives>> get_all_parts() const;

    // New comprehensive methods
    std::vector<std::shared_ptr<sdk::c_primitives>> get_hitbox_parts() const { return hitbox_parts; }
    std::vector<std::shared_ptr<sdk::c_primitives>> get_drawable_parts() const { return drawable_parts; }
    std::vector<std::shared_ptr<sdk::c_primitives>> get_accessory_parts() const { return accessory_parts; }

    // Get specific important parts
    std::shared_ptr<sdk::c_primitives> get_head() const;
    std::shared_ptr<sdk::c_primitives> get_torso() const;
    std::shared_ptr<sdk::c_primitives> get_humanoid_root_part() const;
    std::shared_ptr<sdk::c_primitives> get_left_arm() const;
    std::shared_ptr<sdk::c_primitives> get_right_arm() const;
    std::shared_ptr<sdk::c_primitives> get_left_leg() const;
    std::shared_ptr<sdk::c_primitives> get_right_leg() const;
    std::shared_ptr<sdk::c_primitives> get_left_foot() const;
    std::shared_ptr<sdk::c_primitives> get_right_foot() const;

    // Utility methods
    void categorize_parts();
    e_part_type get_part_type(const std::string& part_name, const std::string& class_name) const;

    float get_health() const;
    float get_max_health() const;
    bool is_healthy() const;
};

namespace features
{
    class c_cache
    {
    private:
        std::vector<std::unique_ptr<entity>> entities;
        mutable std::mutex entities_mutex;
        std::atomic<bool> update_in_progress{ false };
        std::thread background_thread;
        std::atomic<bool> should_stop{ false };
        std::chrono::steady_clock::time_point last_update;
        static constexpr auto UPDATE_INTERVAL = std::chrono::milliseconds(100); // 10 FPS for cache updates
        
        // Phantom Forces support
        std::vector<uint64_t> custom_games = { 113491250, 2746687316 }; // Phantom Forces and other custom games
        bool is_phantom_forces = false;
        uint64_t current_place_id = 0;

    public:
        void update();
        const std::vector<std::unique_ptr<entity>>& get_entities() const { 
            static std::vector<std::unique_ptr<entity>> empty_entities;
            try {
                std::lock_guard<std::mutex> lock(entities_mutex);
                return entities;
            }
            catch (...) {
                return empty_entities;
            }
        }
        std::vector<entity*> get_alive_entities();
        std::vector<entity*> get_healthy_entities();
        entity* find_by_name(const std::string& name);
        size_t count() const { 
            try {
                std::lock_guard<std::mutex> lock(entities_mutex);
                return entities.size();
            }
            catch (...) {
                return 0;
            }
        }
        void clear() {
            try {
                std::lock_guard<std::mutex> lock(entities_mutex);
                entities.clear();
            }
            catch (...) {
                // Handle any exceptions during clear
            }
        }
        
        // Phantom Forces support methods
        bool is_custom_game() const { return is_phantom_forces; }
        uint64_t get_place_id() const { return current_place_id; }
        std::vector<std::shared_ptr<sdk::c_instance>> get_phantom_forces_players();
        std::vector<std::shared_ptr<sdk::c_instance>> get_custom_game_players();
        std::vector<std::shared_ptr<sdk::c_instance>> get_standard_players();
        void start_background_updates();
        void stop_background_updates();
        void update_async();

        // New convenience methods for working with categorized parts
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_hitbox_parts();
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_drawable_parts();
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_accessory_parts();

        // Get specific parts from all players
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_heads();
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_torsos();
        std::vector<std::shared_ptr<sdk::c_primitives>> get_all_humanoid_root_parts();

        // Statistics
        size_t get_total_part_count() const;
        size_t get_total_hitbox_count() const;
        size_t get_total_drawable_count() const;

        // Destructor to ensure proper cleanup
        ~c_cache() {
            stop_background_updates();
        }
    };

    inline std::unique_ptr<c_cache> cache = std::make_unique<c_cache>();
}