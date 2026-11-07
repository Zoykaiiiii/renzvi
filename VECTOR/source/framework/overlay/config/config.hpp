#pragma once

#include <string>
#include <vector>
#include <filesystem>
#include <source/utils/json/json.hpp>
#include <source/framework/globals/globals.hpp>

namespace config
{
    class c_config_manager
    {
    public:
        c_config_manager();
        ~c_config_manager();

        static bool is_valid_config_name(const std::string& name) noexcept;

        // Core config operations
        bool save_config(const std::string& config_name);
        bool load_config(const std::string& config_name);
        bool delete_config(const std::string& config_name);
        bool reset_to_defaults();
        
        // Profile management
        std::vector<std::string> get_available_configs();
        std::string get_current_config() const;
        void set_current_config(const std::string& config_name) { if (is_valid_config_name(config_name)) current_config = config_name; }
        
        // Auto-load functionality
        bool auto_load_last_config();
        void save_last_config_name(const std::string& config_name);

    private:
        std::string config_directory;
        std::string current_config;
        
        // JSON serialization helpers
        nlohmann::json serialize_globals();
        bool deserialize_globals(const nlohmann::json& config_data);
        
        // File operations
        std::string get_config_path(const std::string& config_name);
        bool ensure_config_directory();
        
        // Individual setting serialization
        void serialize_aimlock_settings(nlohmann::json& json);
        void serialize_silent_aim_settings(nlohmann::json& json);
        void serialize_esp_settings(nlohmann::json& json);
        void serialize_movement_settings(nlohmann::json& json);
        void serialize_visual_settings(nlohmann::json& json);
        void serialize_keybind_settings(nlohmann::json& json);
        void serialize_general_settings(nlohmann::json& json);
        
        // Individual setting deserialization
        void deserialize_aimlock_settings(const nlohmann::json& json);
        void deserialize_silent_aim_settings(const nlohmann::json& json);
        void deserialize_esp_settings(const nlohmann::json& json);
        void deserialize_movement_settings(const nlohmann::json& json);
        void deserialize_visual_settings(const nlohmann::json& json);
        void deserialize_keybind_settings(const nlohmann::json& json);
        void deserialize_general_settings(const nlohmann::json& json);
    };

    inline std::unique_ptr<c_config_manager> config_manager = std::make_unique<c_config_manager>();
}
