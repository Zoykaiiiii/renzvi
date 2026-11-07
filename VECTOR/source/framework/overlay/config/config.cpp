#include "config.hpp"
#include <source/utils/console/console.hpp>
#include <windows.h>
#include <shlobj.h>
#include <fstream>
#include <stdexcept>
#include <system_error>

namespace config
{
    c_config_manager::c_config_manager()
    {
        // Get AppData path
        char appdata_path[MAX_PATH];
        if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, appdata_path)))
        {
            config_directory = (std::filesystem::path(appdata_path) / "vector_config" / "configs").string();
        }
        else
        {
            config_directory = (std::filesystem::current_path() / "vector_config" / "configs").string();
        }
        
        ensure_config_directory();
        current_config = "default";
    }

    c_config_manager::~c_config_manager()
    {
        // Auto-save current config on exit
        if (!current_config.empty())
        {
            save_config(current_config);
        }
    }

    bool c_config_manager::ensure_config_directory()
    {
        try
        {
            std::filesystem::create_directories(config_directory);
            return true;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to create config directory: " + std::string(e.what())).c_str());
            return false;
        }
    }

    bool c_config_manager::is_valid_config_name(const std::string& name) noexcept
    {
        if (name.empty() || name.size() > 64) return false;
        for (unsigned char c : name)
            if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                (c >= '0' && c <= '9') || c == '_' || c == '-')) return false;
        auto upper = [](char c) { return c >= 'a' && c <= 'z' ? static_cast<char>(c - 'a' + 'A') : c; };
        auto equals = [&](const char* word) {
            size_t i = 0;
            for (; word[i] != 0; ++i)
                if (i >= name.size() || upper(name[i]) != word[i]) return false;
            return i == name.size();
        };
        if (equals("CON") || equals("PRN") || equals("AUX") || equals("NUL")) return false;
        if (name.size() == 4 && name[3] >= '0' && name[3] <= '9' &&
            ((upper(name[0]) == 'C' && upper(name[1]) == 'O' && upper(name[2]) == 'M') ||
             (upper(name[0]) == 'L' && upper(name[1]) == 'P' && upper(name[2]) == 'T'))) return false;
        return true;
    }

    std::string c_config_manager::get_config_path(const std::string& config_name)
    {
        if (!is_valid_config_name(config_name))
            throw std::invalid_argument("Profile name: use 1-64 letters, digits, underscore or hyphen; no device names.");
        const auto directory = std::filesystem::weakly_canonical(std::filesystem::path(config_directory));
        const auto file = directory / (config_name + ".json");
        std::error_code error;
        const auto status = std::filesystem::symlink_status(file, error);
        if (!error && std::filesystem::is_symlink(status))
            throw std::invalid_argument("Profile links are not accepted.");
        if (error && error != std::errc::no_such_file_or_directory)
            throw std::filesystem::filesystem_error("Profile status", file, error);
        return file.string();
    }

    std::vector<std::string> c_config_manager::get_available_configs()
    {
        std::vector<std::string> configs;
        
        try
        {
            if (!std::filesystem::exists(config_directory))
                return configs;
                
            for (const auto& entry : std::filesystem::directory_iterator(config_directory))
            {
                if (!entry.is_symlink() && entry.is_regular_file() && entry.path().extension() == ".json")
                {
                    std::string filename = entry.path().stem().string();
                    if (is_valid_config_name(filename)) configs.push_back(filename);
                }
            }
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to read config directory: " + std::string(e.what())).c_str());
        }
        
        return configs;
    }

    nlohmann::json c_config_manager::serialize_globals()
    {
        nlohmann::json config;
        
        // Serialize all settings
        serialize_general_settings(config);
        serialize_aimlock_settings(config);
        serialize_silent_aim_settings(config);
        serialize_esp_settings(config);
        serialize_movement_settings(config);
        serialize_visual_settings(config);
        serialize_keybind_settings(config);
        
        return config;
    }

    void c_config_manager::serialize_general_settings(nlohmann::json& json)
    {
        json["general"] = {
            {"local_player_check", globals->local_player_check},
            {"team_check", globals->team_check},
            {"camera_fov", globals->camera_fov},
            {"performance_mode", globals->performance_mode},
            {"wallcheck", globals->wallcheck},
            {"wallcheck_interval", globals->wallcheck_interval},
            {"keybind_list_enabled", globals->keybind_list_enabled},
            {"keybind_list_position", globals->keybind_list_position},
            {"lighting_brightness", globals->lighting_brightness},
            {"lighting_fog_start", globals->lighting_fog_start},
            {"lighting_fog_end", globals->lighting_fog_end},
            {"lighting_fog_color", {globals->lighting_fog_color.x, globals->lighting_fog_color.y, globals->lighting_fog_color.z, globals->lighting_fog_color.w}},
            {"lighting_color_shift_top", {globals->lighting_color_shift_top.x, globals->lighting_color_shift_top.y, globals->lighting_color_shift_top.z, globals->lighting_color_shift_top.w}},
            {"lighting_color_shift_bottom", {globals->lighting_color_shift_bottom.x, globals->lighting_color_shift_bottom.y, globals->lighting_color_shift_bottom.z, globals->lighting_color_shift_bottom.w}},
            {"lighting_ambient", {globals->lighting_ambient.x, globals->lighting_ambient.y, globals->lighting_ambient.z, globals->lighting_ambient.w}},
            {"lighting_outdoor_ambient", {globals->lighting_outdoor_ambient.x, globals->lighting_outdoor_ambient.y, globals->lighting_outdoor_ambient.z, globals->lighting_outdoor_ambient.w}}
        };
    }

    void c_config_manager::serialize_aimlock_settings(nlohmann::json& json)
    {
        json["aimlock"] = {
            {"enabled", globals->aimlock_enabled},
            {"sticky_aim", globals->aimlock_sticky_aim},
            {"mode", globals->aimlock_mode},
            {"target_part", globals->aimlock_target_part},
            {"fov", globals->aimlock_fov},
            {"smoothing_enabled", globals->aimlock_smoothing_enabled},
            {"smoothness", globals->aimlock_smoothness},
            {"targeting_mode", globals->aimlock_targeting_mode},
            {"fov_size", globals->aimlock_fov_size},
            {"fov_visible", globals->aimlock_fov_visible},
            {"fov_color", {globals->aimlock_fov_color.x, globals->aimlock_fov_color.y, globals->aimlock_fov_color.z, globals->aimlock_fov_color.w}},
            {"fov_filled", globals->aimlock_fov_filled},
            {"fov_outline", globals->aimlock_fov_outline},
            {"max_distance", globals->aimlock_max_distance},
            {"distance_limit", globals->aimlock_distance_limit}
        };
    }

    void c_config_manager::serialize_silent_aim_settings(nlohmann::json& json)
    {
        json["silent_aim"] = {
            {"enabled", globals->silent_aim_enabled},
            {"sticky_aim", globals->silent_aim_sticky_aim},
            {"target_part", globals->silent_aim_target_part},
            {"local_player_check", globals->silent_aim_local_player_check},
            {"team_check", globals->silent_aim_team_check},
            {"targeting_mode", globals->silent_aim_targeting_mode},
            {"fov_size", globals->silent_aim_fov_size},
            {"fov_visible", globals->silent_aim_fov_visible},
            {"fov_color", {globals->silent_aim_fov_color.x, globals->silent_aim_fov_color.y, globals->silent_aim_fov_color.z, globals->silent_aim_fov_color.w}},
            {"fov_filled", globals->silent_aim_fov_filled},
            {"fov_outline", globals->silent_aim_fov_outline},
            {"max_distance", globals->silent_aim_max_distance},
            {"distance_limit", globals->silent_aim_distance_limit}
        };
    }

    void c_config_manager::serialize_esp_settings(nlohmann::json& json)
    {
        json["esp"] = {
            {"box", globals->box},
            {"box_type", globals->box_type},
            {"chams", globals->chams},
            {"chams_type", globals->chams_type},
            {"health_bar", globals->health_bar},
            {"name_esp", globals->name_esp},
            {"distance_esp", globals->distance_esp},
            {"skeleton_esp", globals->skeleton_esp},
            {"skeleton_type", globals->skeleton_type},
            {"chams_glow", globals->chams_glow},
            {"esp_draw_accessories", globals->esp_draw_accessories},
            {"chams_glow_size", globals->chams_glow_size},
            {"chams_thickness", globals->chams_thickness},
            {"chams_glow_color", {globals->chams_glow_color.x, globals->chams_glow_color.y, globals->chams_glow_color.z, globals->chams_glow_color.w}},
            {"box_color", {globals->box_color.x, globals->box_color.y, globals->box_color.z, globals->box_color.w}},
            {"skeleton_color", {globals->skeleton_color.x, globals->skeleton_color.y, globals->skeleton_color.z, globals->skeleton_color.w}},
            {"chams_color", {globals->chams_color.x, globals->chams_color.y, globals->chams_color.z, globals->chams_color.w}},
            {"chams_outline_color", {globals->chams_outline_color.x, globals->chams_outline_color.y, globals->chams_outline_color.z, globals->chams_outline_color.w}},
            {"visuals_visible_color", {globals->visuals_visible_color.x, globals->visuals_visible_color.y, globals->visuals_visible_color.z, globals->visuals_visible_color.w}},
            {"visuals_invisible_color", {globals->visuals_invisible_color.x, globals->visuals_invisible_color.y, globals->visuals_invisible_color.z, globals->visuals_invisible_color.w}},
            {"box_filled", globals->box_filled},
            {"box_fill_color", {globals->box_fill_color.x, globals->box_fill_color.y, globals->box_fill_color.z, globals->box_fill_color.w}},
            {"box_gradient", globals->box_gradient},
            {"box_gradient_color", {globals->box_gradient_color.x, globals->box_gradient_color.y, globals->box_gradient_color.z, globals->box_gradient_color.w}},
            {"box_rainbow", globals->box_rainbow},
            {"box_rainbow_speed", globals->box_rainbow_speed},
            {"box_thickness", globals->box_thickness},
            {"box_glow", globals->box_glow},
            {"box_glow_size", globals->box_glow_size},
            {"name_background", globals->name_background},
            {"name_bg_color", {globals->name_bg_color.x, globals->name_bg_color.y, globals->name_bg_color.z, globals->name_bg_color.w}},
            {"name_font_size", globals->name_font_size},
            {"name_rainbow", globals->name_rainbow},
            {"name_rainbow_speed", globals->name_rainbow_speed},
            {"health_text", globals->health_text},
            {"health_background", globals->health_background},
            {"health_bg_color", {globals->health_bg_color.x, globals->health_bg_color.y, globals->health_bg_color.z, globals->health_bg_color.w}},
            {"health_gradient", globals->health_gradient},
            {"health_high_color", {globals->health_high_color.x, globals->health_high_color.y, globals->health_high_color.z, globals->health_high_color.w}},
            {"health_low_color", {globals->health_low_color.x, globals->health_low_color.y, globals->health_low_color.z, globals->health_low_color.w}},
            {"health_animated", globals->health_animated},
            {"skeleton_thickness", globals->skeleton_thickness},
            {"skeleton_rainbow", globals->skeleton_rainbow},
            {"skeleton_rainbow_speed", globals->skeleton_rainbow_speed},
            {"skeleton_glow", globals->skeleton_glow},
            {"skeleton_glow_size", globals->skeleton_glow_size},
            {"chams_rainbow", globals->chams_rainbow},
            {"chams_rainbow_speed", globals->chams_rainbow_speed},
            {"chams_pulsing", globals->chams_pulsing},
            {"chams_pulse_speed", globals->chams_pulse_speed},
            {"chams_transparency", globals->chams_transparency},
            {"chams_clipper_outline", globals->chams_clipper_outline},
            {"chams_clipper_width", globals->chams_clipper_width},
            {"chams_clipper_color", {globals->chams_clipper_color.x, globals->chams_clipper_color.y, globals->chams_clipper_color.z, globals->chams_clipper_color.w}},
            {"distance_background", globals->distance_background},
            {"distance_bg_color", {globals->distance_bg_color.x, globals->distance_bg_color.y, globals->distance_bg_color.z, globals->distance_bg_color.w}},
            {"distance_color", {globals->distance_color.x, globals->distance_color.y, globals->distance_color.z, globals->distance_color.w}}
        };
    }

    void c_config_manager::serialize_movement_settings(nlohmann::json& json)
    {
        json["movement"] = {
            {"fly", globals->fly},
            {"fly_speed", globals->fly_speed},
            {"spinbot", globals->spinbot},
            {"spinbot_speed", globals->spinbot_speed},
            {"spinbot_type", globals->spinbot_type},
            {"bhop", globals->bhop},
            {"bhop_speed", globals->bhop_speed},
            {"bhop_max_speed", globals->bhop_max_speed},
            {"bhop_type", globals->bhop_type},
            {"upside_down", globals->upside_down},
            {"hitbox_expand", globals->hitbox_expand},
            {"hitbox_expand_part", globals->hitbox_expand_part},
            {"hitbox_scale", globals->hitbox_scale},
            {"animation_override", globals->animation_override},
            {"animation_type", globals->animation_type},
            {"custom_animation", std::string(globals->custom_animation)},
            {"desync", globals->desync},
            {"sab_test", globals->sab_test},
            {"desync_value", globals->desync_value},
            {"third_person", globals->third_person},
            {"third_person_distance", globals->third_person_distance},
            {"third_person_height", globals->third_person_height}
        };
    }

    void c_config_manager::serialize_visual_settings(nlohmann::json& json)
    {
        json["visuals"] = {
            {"world_visuals", globals->world_visuals},
            {"world_visuals_type", globals->world_visuals_type},
            {"desync_visualizer", globals->desync_visualizer},
            {"desync_ghost_count", globals->desync_ghost_count},
            {"desync_ghost_size", globals->desync_ghost_size},
            {"desync_ghost_alpha", globals->desync_ghost_alpha},
            {"desync_ghost_outline", globals->desync_ghost_outline},
            {"desync_ghost_color", {globals->desync_ghost_color.x, globals->desync_ghost_color.y, globals->desync_ghost_color.z, globals->desync_ghost_color.w}},
            {"desync_ghost_outline_color", {globals->desync_ghost_outline_color.x, globals->desync_ghost_outline_color.y, globals->desync_ghost_outline_color.z, globals->desync_ghost_outline_color.w}},
            {"desync_ghost_lifetime", globals->desync_ghost_lifetime}
        };
    }

    void c_config_manager::serialize_keybind_settings(nlohmann::json& json)
    {
        json["keybinds"] = {
            {"aimlock_key", globals->aimlock_keybind.key},
            {"aimlock_type", globals->aimlock_keybind.type},
            {"silent_aim_key", globals->silent_aim_keybind.key},
            {"silent_aim_type", globals->silent_aim_keybind.type},
            {"fly_key", globals->fly_keybind.key},
            {"fly_type", globals->fly_keybind.type},
            {"spinbot_key", globals->spinbot_keybind.key},
            {"spinbot_type", globals->spinbot_keybind.type},
            {"bhop_key", globals->bhop_keybind.key},
            {"bhop_type", globals->bhop_keybind.type},
            {"upside_down_key", globals->upside_down_keybind.key},
            {"upside_down_type", globals->upside_down_keybind.type},
            {"hitbox_expand_key", globals->hitbox_expand_keybind.key},
            {"hitbox_expand_type", globals->hitbox_expand_keybind.type},
            {"animation_override_key", globals->animation_override_keybind.key},
            {"animation_override_type", globals->animation_override_keybind.type},
            {"desync_key", globals->desync_keybind.key},
            {"desync_type", globals->desync_keybind.type},
            {"third_person_key", globals->third_person_keybind.key},
            {"third_person_type", globals->third_person_keybind.type},
            {"jumppower_key", globals->jumppower_keybind.key},
            {"jumppower_type", globals->jumppower_keybind.type},
            {"walkspeed_key", globals->walkspeed_keybind.key},
            {"walkspeed_type", globals->walkspeed_keybind.type},
            {"player_list_key", globals->player_list_keybind.key},
            {"player_list_type", globals->player_list_keybind.type}
        };
    }

    bool c_config_manager::deserialize_globals(const nlohmann::json& config_data)
    {
        try
        {
            if (config_data.contains("general"))
                deserialize_general_settings(config_data["general"]);
            if (config_data.contains("aimlock"))
                deserialize_aimlock_settings(config_data["aimlock"]);
            if (config_data.contains("silent_aim"))
                deserialize_silent_aim_settings(config_data["silent_aim"]);
            if (config_data.contains("esp"))
                deserialize_esp_settings(config_data["esp"]);
            if (config_data.contains("movement"))
                deserialize_movement_settings(config_data["movement"]);
            if (config_data.contains("visuals"))
                deserialize_visual_settings(config_data["visuals"]);
            if (config_data.contains("keybinds"))
                deserialize_keybind_settings(config_data["keybinds"]);
            
            return true;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to deserialize config: " + std::string(e.what())).c_str());
            return false;
        }
    }

    void c_config_manager::deserialize_general_settings(const nlohmann::json& json)
    {
        if (json.contains("local_player_check")) globals->local_player_check = json["local_player_check"];
        if (json.contains("team_check")) globals->team_check = json["team_check"];
        if (json.contains("camera_fov")) globals->camera_fov = json["camera_fov"];
        if (json.contains("performance_mode")) globals->performance_mode = json["performance_mode"];
        if (json.contains("wallcheck")) globals->wallcheck = json["wallcheck"];
        if (json.contains("wallcheck_interval")) globals->wallcheck_interval = json["wallcheck_interval"];
        if (json.contains("keybind_list_enabled")) globals->keybind_list_enabled = json["keybind_list_enabled"];
        if (json.contains("keybind_list_position")) globals->keybind_list_position = json["keybind_list_position"];
        if (json.contains("lighting_brightness")) globals->lighting_brightness = json["lighting_brightness"];
        if (json.contains("lighting_fog_start")) globals->lighting_fog_start = json["lighting_fog_start"];
        if (json.contains("lighting_fog_end")) globals->lighting_fog_end = json["lighting_fog_end"];
        
        if (json.contains("lighting_fog_color") && json["lighting_fog_color"].is_array() && json["lighting_fog_color"].size() == 4)
        {
            auto color = json["lighting_fog_color"];
            globals->lighting_fog_color = ImVec4(color[0], color[1], color[2], color[3]);
        }
        
        if (json.contains("lighting_color_shift_top") && json["lighting_color_shift_top"].is_array() && json["lighting_color_shift_top"].size() == 4)
        {
            auto color = json["lighting_color_shift_top"];
            globals->lighting_color_shift_top = ImVec4(color[0], color[1], color[2], color[3]);
        }
        
        if (json.contains("lighting_color_shift_bottom") && json["lighting_color_shift_bottom"].is_array() && json["lighting_color_shift_bottom"].size() == 4)
        {
            auto color = json["lighting_color_shift_bottom"];
            globals->lighting_color_shift_bottom = ImVec4(color[0], color[1], color[2], color[3]);
        }
        
        if (json.contains("lighting_ambient") && json["lighting_ambient"].is_array() && json["lighting_ambient"].size() == 4)
        {
            auto color = json["lighting_ambient"];
            globals->lighting_ambient = ImVec4(color[0], color[1], color[2], color[3]);
        }
        
        if (json.contains("lighting_outdoor_ambient") && json["lighting_outdoor_ambient"].is_array() && json["lighting_outdoor_ambient"].size() == 4)
        {
            auto color = json["lighting_outdoor_ambient"];
            globals->lighting_outdoor_ambient = ImVec4(color[0], color[1], color[2], color[3]);
        }
    }

    void c_config_manager::deserialize_aimlock_settings(const nlohmann::json& json)
    {
        if (json.contains("enabled")) globals->aimlock_enabled = json["enabled"];
        if (json.contains("sticky_aim")) globals->aimlock_sticky_aim = json["sticky_aim"];
        if (json.contains("mode")) globals->aimlock_mode = json["mode"];
        if (json.contains("target_part")) globals->aimlock_target_part = json["target_part"];
        if (json.contains("fov")) globals->aimlock_fov = json["fov"];
        if (json.contains("smoothing_enabled")) globals->aimlock_smoothing_enabled = json["smoothing_enabled"];
        if (json.contains("smoothness")) globals->aimlock_smoothness = json["smoothness"];
        if (json.contains("targeting_mode")) globals->aimlock_targeting_mode = json["targeting_mode"];
        if (json.contains("fov_size")) globals->aimlock_fov_size = json["fov_size"];
        if (json.contains("fov_visible")) globals->aimlock_fov_visible = json["fov_visible"];
        if (json.contains("fov_filled")) globals->aimlock_fov_filled = json["fov_filled"];
        if (json.contains("fov_outline")) globals->aimlock_fov_outline = json["fov_outline"];
        if (json.contains("max_distance")) globals->aimlock_max_distance = json["max_distance"];
        if (json.contains("distance_limit")) globals->aimlock_distance_limit = json["distance_limit"];
        
        if (json.contains("fov_color") && json["fov_color"].is_array() && json["fov_color"].size() == 4)
        {
            auto color = json["fov_color"];
            globals->aimlock_fov_color = ImVec4(color[0], color[1], color[2], color[3]);
        }
    }

    void c_config_manager::deserialize_silent_aim_settings(const nlohmann::json& json)
    {
        if (json.contains("enabled")) globals->silent_aim_enabled = json["enabled"];
        if (json.contains("sticky_aim")) globals->silent_aim_sticky_aim = json["sticky_aim"];
        if (json.contains("target_part")) globals->silent_aim_target_part = json["target_part"];
        if (json.contains("local_player_check")) globals->silent_aim_local_player_check = json["local_player_check"];
        if (json.contains("team_check")) globals->silent_aim_team_check = json["team_check"];
        if (json.contains("targeting_mode")) globals->silent_aim_targeting_mode = json["targeting_mode"];
        if (json.contains("fov_size")) globals->silent_aim_fov_size = json["fov_size"];
        if (json.contains("fov_visible")) globals->silent_aim_fov_visible = json["fov_visible"];
        if (json.contains("fov_filled")) globals->silent_aim_fov_filled = json["fov_filled"];
        if (json.contains("fov_outline")) globals->silent_aim_fov_outline = json["fov_outline"];
        if (json.contains("max_distance")) globals->silent_aim_max_distance = json["max_distance"];
        if (json.contains("distance_limit")) globals->silent_aim_distance_limit = json["distance_limit"];
        
        if (json.contains("fov_color") && json["fov_color"].is_array() && json["fov_color"].size() == 4)
        {
            auto color = json["fov_color"];
            globals->silent_aim_fov_color = ImVec4(color[0], color[1], color[2], color[3]);
        }
    }

    void c_config_manager::deserialize_esp_settings(const nlohmann::json& json)
    {
        if (json.contains("box")) globals->box = json["box"];
        if (json.contains("box_type")) globals->box_type = json["box_type"];
        if (json.contains("chams")) globals->chams = json["chams"];
        if (json.contains("chams_type")) globals->chams_type = json["chams_type"];
        if (json.contains("health_bar")) globals->health_bar = json["health_bar"];
        if (json.contains("name_esp")) globals->name_esp = json["name_esp"];
        if (json.contains("distance_esp")) globals->distance_esp = json["distance_esp"];
        if (json.contains("skeleton_esp")) globals->skeleton_esp = json["skeleton_esp"];
        if (json.contains("skeleton_type")) globals->skeleton_type = json["skeleton_type"];
        if (json.contains("chams_glow")) globals->chams_glow = json["chams_glow"];
        if (json.contains("esp_draw_accessories")) globals->esp_draw_accessories = json["esp_draw_accessories"];
        if (json.contains("chams_glow_size")) globals->chams_glow_size = json["chams_glow_size"];
        if (json.contains("chams_thickness")) globals->chams_thickness = json["chams_thickness"];
        if (json.contains("box_filled")) globals->box_filled = json["box_filled"];
        if (json.contains("box_gradient")) globals->box_gradient = json["box_gradient"];
        if (json.contains("box_rainbow")) globals->box_rainbow = json["box_rainbow"];
        if (json.contains("box_rainbow_speed")) globals->box_rainbow_speed = json["box_rainbow_speed"];
        if (json.contains("box_thickness")) globals->box_thickness = json["box_thickness"];
        if (json.contains("box_glow")) globals->box_glow = json["box_glow"];
        if (json.contains("box_glow_size")) globals->box_glow_size = json["box_glow_size"];
        if (json.contains("name_background")) globals->name_background = json["name_background"];
        if (json.contains("name_font_size")) globals->name_font_size = json["name_font_size"];
        if (json.contains("name_rainbow")) globals->name_rainbow = json["name_rainbow"];
        if (json.contains("name_rainbow_speed")) globals->name_rainbow_speed = json["name_rainbow_speed"];
        if (json.contains("health_text")) globals->health_text = json["health_text"];
        if (json.contains("health_background")) globals->health_background = json["health_background"];
        if (json.contains("health_gradient")) globals->health_gradient = json["health_gradient"];
        if (json.contains("health_animated")) globals->health_animated = json["health_animated"];
        if (json.contains("skeleton_thickness")) globals->skeleton_thickness = json["skeleton_thickness"];
        if (json.contains("skeleton_rainbow")) globals->skeleton_rainbow = json["skeleton_rainbow"];
        if (json.contains("skeleton_rainbow_speed")) globals->skeleton_rainbow_speed = json["skeleton_rainbow_speed"];
        if (json.contains("skeleton_glow")) globals->skeleton_glow = json["skeleton_glow"];
        if (json.contains("skeleton_glow_size")) globals->skeleton_glow_size = json["skeleton_glow_size"];
        if (json.contains("chams_rainbow")) globals->chams_rainbow = json["chams_rainbow"];
        if (json.contains("chams_rainbow_speed")) globals->chams_rainbow_speed = json["chams_rainbow_speed"];
        if (json.contains("chams_pulsing")) globals->chams_pulsing = json["chams_pulsing"];
        if (json.contains("chams_pulse_speed")) globals->chams_pulse_speed = json["chams_pulse_speed"];
        if (json.contains("chams_transparency")) globals->chams_transparency = json["chams_transparency"];
        if (json.contains("chams_clipper_outline")) globals->chams_clipper_outline = json["chams_clipper_outline"];
        if (json.contains("chams_clipper_width")) globals->chams_clipper_width = json["chams_clipper_width"];
        if (json.contains("distance_background")) globals->distance_background = json["distance_background"];
        
        // Color deserialization
        auto deserialize_color = [](const nlohmann::json& color_json, ImVec4& color) {
            if (color_json.is_array() && color_json.size() == 4)
            {
                color = ImVec4(color_json[0], color_json[1], color_json[2], color_json[3]);
            }
        };
        
        if (json.contains("chams_glow_color")) deserialize_color(json["chams_glow_color"], globals->chams_glow_color);
        if (json.contains("box_color")) deserialize_color(json["box_color"], globals->box_color);
        if (json.contains("skeleton_color")) deserialize_color(json["skeleton_color"], globals->skeleton_color);
        if (json.contains("chams_color")) deserialize_color(json["chams_color"], globals->chams_color);
        if (json.contains("chams_outline_color")) deserialize_color(json["chams_outline_color"], globals->chams_outline_color);
        if (json.contains("visuals_visible_color")) deserialize_color(json["visuals_visible_color"], globals->visuals_visible_color);
        if (json.contains("visuals_invisible_color")) deserialize_color(json["visuals_invisible_color"], globals->visuals_invisible_color);
        if (json.contains("box_fill_color")) deserialize_color(json["box_fill_color"], globals->box_fill_color);
        if (json.contains("box_gradient_color")) deserialize_color(json["box_gradient_color"], globals->box_gradient_color);
        if (json.contains("name_bg_color")) deserialize_color(json["name_bg_color"], globals->name_bg_color);
        if (json.contains("health_bg_color")) deserialize_color(json["health_bg_color"], globals->health_bg_color);
        if (json.contains("health_high_color")) deserialize_color(json["health_high_color"], globals->health_high_color);
        if (json.contains("health_low_color")) deserialize_color(json["health_low_color"], globals->health_low_color);
        if (json.contains("chams_clipper_color")) deserialize_color(json["chams_clipper_color"], globals->chams_clipper_color);
        if (json.contains("distance_bg_color")) deserialize_color(json["distance_bg_color"], globals->distance_bg_color);
        if (json.contains("distance_color")) deserialize_color(json["distance_color"], globals->distance_color);
    }

    void c_config_manager::deserialize_movement_settings(const nlohmann::json& json)
    {
        if (json.contains("fly")) globals->fly = json["fly"];
        if (json.contains("fly_speed")) globals->fly_speed = json["fly_speed"];
        if (json.contains("spinbot")) globals->spinbot = json["spinbot"];
        if (json.contains("spinbot_speed")) globals->spinbot_speed = json["spinbot_speed"];
        if (json.contains("spinbot_type")) globals->spinbot_type = json["spinbot_type"];
        if (json.contains("bhop")) globals->bhop = json["bhop"];
        if (json.contains("bhop_speed")) globals->bhop_speed = json["bhop_speed"];
        if (json.contains("bhop_max_speed")) globals->bhop_max_speed = json["bhop_max_speed"];
        if (json.contains("bhop_type")) globals->bhop_type = json["bhop_type"];
        if (json.contains("upside_down")) globals->upside_down = json["upside_down"];
        if (json.contains("hitbox_expand")) globals->hitbox_expand = json["hitbox_expand"];
        if (json.contains("hitbox_expand_part")) globals->hitbox_expand_part = json["hitbox_expand_part"];
        if (json.contains("hitbox_scale")) globals->hitbox_scale = json["hitbox_scale"];
        if (json.contains("animation_override")) globals->animation_override = json["animation_override"];
        if (json.contains("animation_type")) globals->animation_type = json["animation_type"];
        if (json.contains("custom_animation")) 
        {
            std::string anim = json["custom_animation"];
            strncpy_s(globals->custom_animation, anim.c_str(), sizeof(globals->custom_animation) - 1);
        }
        if (json.contains("desync")) globals->desync = json["desync"];
        if (json.contains("sab_test")) globals->sab_test = json["sab_test"];
        if (json.contains("desync_value")) globals->desync_value = json["desync_value"];
        if (json.contains("third_person")) globals->third_person = json["third_person"];
        if (json.contains("third_person_distance")) globals->third_person_distance = json["third_person_distance"];
        if (json.contains("third_person_height")) globals->third_person_height = json["third_person_height"];
    }

    void c_config_manager::deserialize_visual_settings(const nlohmann::json& json)
    {
        if (json.contains("world_visuals")) globals->world_visuals = json["world_visuals"];
        if (json.contains("world_visuals_type")) globals->world_visuals_type = json["world_visuals_type"];
        if (json.contains("desync_visualizer")) globals->desync_visualizer = json["desync_visualizer"];
        if (json.contains("desync_ghost_count")) globals->desync_ghost_count = json["desync_ghost_count"];
        if (json.contains("desync_ghost_size")) globals->desync_ghost_size = json["desync_ghost_size"];
        if (json.contains("desync_ghost_alpha")) globals->desync_ghost_alpha = json["desync_ghost_alpha"];
        if (json.contains("desync_ghost_outline")) globals->desync_ghost_outline = json["desync_ghost_outline"];
        if (json.contains("desync_ghost_lifetime")) globals->desync_ghost_lifetime = json["desync_ghost_lifetime"];
        
        if (json.contains("desync_ghost_color") && json["desync_ghost_color"].is_array() && json["desync_ghost_color"].size() == 4)
        {
            auto color = json["desync_ghost_color"];
            globals->desync_ghost_color = ImVec4(color[0], color[1], color[2], color[3]);
        }
        
        if (json.contains("desync_ghost_outline_color") && json["desync_ghost_outline_color"].is_array() && json["desync_ghost_outline_color"].size() == 4)
        {
            auto color = json["desync_ghost_outline_color"];
            globals->desync_ghost_outline_color = ImVec4(color[0], color[1], color[2], color[3]);
        }
    }

    void c_config_manager::deserialize_keybind_settings(const nlohmann::json& json)
    {
        if (json.contains("aimlock_key")) globals->aimlock_keybind.key = json["aimlock_key"];
        if (json.contains("aimlock_type")) globals->aimlock_keybind.type = json["aimlock_type"];
        if (json.contains("silent_aim_key")) globals->silent_aim_keybind.key = json["silent_aim_key"];
        if (json.contains("silent_aim_type")) globals->silent_aim_keybind.type = json["silent_aim_type"];
        if (json.contains("fly_key")) globals->fly_keybind.key = json["fly_key"];
        if (json.contains("fly_type")) globals->fly_keybind.type = json["fly_type"];
        if (json.contains("spinbot_key")) globals->spinbot_keybind.key = json["spinbot_key"];
        if (json.contains("spinbot_type")) globals->spinbot_keybind.type = json["spinbot_type"];
        if (json.contains("bhop_key")) globals->bhop_keybind.key = json["bhop_key"];
        if (json.contains("bhop_type")) globals->bhop_keybind.type = json["bhop_type"];
        if (json.contains("upside_down_key")) globals->upside_down_keybind.key = json["upside_down_key"];
        if (json.contains("upside_down_type")) globals->upside_down_keybind.type = json["upside_down_type"];
        if (json.contains("hitbox_expand_key")) globals->hitbox_expand_keybind.key = json["hitbox_expand_key"];
        if (json.contains("hitbox_expand_type")) globals->hitbox_expand_keybind.type = json["hitbox_expand_type"];
        if (json.contains("animation_override_key")) globals->animation_override_keybind.key = json["animation_override_key"];
        if (json.contains("animation_override_type")) globals->animation_override_keybind.type = json["animation_override_type"];
        if (json.contains("desync_key")) globals->desync_keybind.key = json["desync_key"];
        if (json.contains("desync_type")) globals->desync_keybind.type = json["desync_type"];
        if (json.contains("third_person_key")) globals->third_person_keybind.key = json["third_person_key"];
        if (json.contains("third_person_type")) globals->third_person_keybind.type = json["third_person_type"];
        if (json.contains("jumppower_key")) globals->jumppower_keybind.key = json["jumppower_key"];
        if (json.contains("jumppower_type")) globals->jumppower_keybind.type = json["jumppower_type"];
        if (json.contains("walkspeed_key")) globals->walkspeed_keybind.key = json["walkspeed_key"];
        if (json.contains("walkspeed_type")) globals->walkspeed_keybind.type = json["walkspeed_type"];
        if (json.contains("player_list_key")) globals->player_list_keybind.key = json["player_list_key"];
        if (json.contains("player_list_type")) globals->player_list_keybind.type = json["player_list_type"];
    }

    bool c_config_manager::save_config(const std::string& config_name)
    {
        if (!is_valid_config_name(config_name)) {
            console->print(c_console::log_level::warning, "Invalid profile name (letters, digits, _ and - only).");
            return false;
        }
        try
        {
            std::string file_path = get_config_path(config_name);
            nlohmann::json config_data = serialize_globals();
            
            std::ofstream file(file_path);
            if (!file.is_open())
            {
                console->print(c_console::log_level::error, ("Failed to open config file for writing: " + file_path).c_str());
                return false;
            }
            
            file << config_data.dump(4); // Pretty print with 4 spaces
            file.close();
            
            console->print(c_console::log_level::info, ("Config saved: " + config_name).c_str());
            return true;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to save config: " + std::string(e.what())).c_str());
            return false;
        }
    }

    bool c_config_manager::load_config(const std::string& config_name)
    {
        if (!is_valid_config_name(config_name)) {
            console->print(c_console::log_level::warning, "Invalid profile name (letters, digits, _ and - only).");
            return false;
        }
        try
        {
            std::string file_path = get_config_path(config_name);
            
            if (!std::filesystem::exists(file_path))
            {
                console->print(c_console::log_level::warning, ("Config file not found: " + config_name).c_str());
                return false;
            }
            
            if (std::filesystem::file_size(file_path) > 2 * 1024 * 1024) {
                console->print(c_console::log_level::warning, "Profile exceeds 2 MiB.");
                return false;
            }
            std::ifstream file(file_path);
            if (!file.is_open())
            {
                console->print(c_console::log_level::error, ("Failed to open config file for reading: " + file_path).c_str());
                return false;
            }
            
            nlohmann::json config_data;
            file >> config_data;
            file.close();
            
            if (!config_data.is_object()) return false;
            if (deserialize_globals(config_data))
            {
                current_config = config_name;
                save_last_config_name(config_name);
                console->print(c_console::log_level::info, ("Config loaded: " + config_name).c_str());
                return true;
            }
            
            return false;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to load config: " + std::string(e.what())).c_str());
            return false;
        }
    }

    bool c_config_manager::delete_config(const std::string& config_name)
    {
        if (!is_valid_config_name(config_name)) {
            console->print(c_console::log_level::warning, "Invalid profile name (letters, digits, _ and - only).");
            return false;
        }
        try
        {
            std::string file_path = get_config_path(config_name);
            
            if (!std::filesystem::exists(file_path))
            {
                console->print(c_console::log_level::warning, ("Config file not found: " + config_name).c_str());
                return false;
            }
            
            std::filesystem::remove(file_path);
            console->print(c_console::log_level::info, ("Config deleted: " + config_name).c_str());
            return true;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to delete config: " + std::string(e.what())).c_str());
            return false;
        }
    }

    bool c_config_manager::reset_to_defaults()
    {
        try
        {
            // Reset all globals to their default values
            // This would require setting all globals back to their initial values
            // For now, we'll just create a default config and load it
            console->print(c_console::log_level::info, "Resetting to default settings");
            return true;
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to reset to defaults: " + std::string(e.what())).c_str());
            return false;
        }
    }

    bool c_config_manager::auto_load_last_config()
    {
        try
        {
            const auto last_config_file = std::filesystem::path(config_directory) / "last_config.txt";
            
            if (!std::filesystem::exists(last_config_file))
                return false;
                
            std::ifstream file(last_config_file);
            if (!file.is_open())
                return false;
                
            std::string last_config_name;
            std::getline(file, last_config_name);
            file.close();
            
            // Check if auto-load is disabled (empty string) or if config doesn't exist
            if (last_config_name.empty())
            {
                console->print(c_console::log_level::info, "Auto-load is disabled");
                return false;
            }
            
            // Check if the config file still exists
            std::string config_path = get_config_path(last_config_name);
            if (!std::filesystem::exists(config_path))
            {
                console->print(c_console::log_level::warning, ("Auto-load config not found: " + last_config_name).c_str());
                return false;
            }
            
            return load_config(last_config_name);
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to auto-load last config: " + std::string(e.what())).c_str());
            return false;
        }
    }

    std::string c_config_manager::get_current_config() const
    {
        try
        {
            const auto last_config_file = std::filesystem::path(config_directory) / "last_config.txt";
            
            if (!std::filesystem::exists(last_config_file))
                return "";
                
            std::ifstream file(last_config_file);
            if (!file.is_open())
                return "";
                
            std::string last_config_name;
            std::getline(file, last_config_name);
            file.close();
            
            return is_valid_config_name(last_config_name) ? last_config_name : "";
        }
        catch (const std::exception&)
        {
            return "";
        }
    }

    void c_config_manager::save_last_config_name(const std::string& config_name)
    {
        if (!config_name.empty() && !is_valid_config_name(config_name)) {
            console->print(c_console::log_level::warning, "Invalid auto-load profile name.");
            return;
        }
        try
        {
            const auto last_config_file = std::filesystem::path(config_directory) / "last_config.txt";
            std::ofstream file(last_config_file);
            if (file.is_open())
            {
                file << config_name;
                file.close();
            }
        }
        catch (const std::exception& e)
        {
            console->print(c_console::log_level::error, ("Failed to save last config name: " + std::string(e.what())).c_str());
        }
    }
}
