#pragma once
#include <memory>
#include <wtypes.h>
#include <vector>

#include <source/framework/sdk/includes.hpp>

class c_globals
{
public:
    // Core system
    static inline DWORD                                    pid = 0;
    static inline HANDLE                                   handle = nullptr;
    static inline uintptr_t                                base = 0;

    // SDK instances
    static inline std::shared_ptr<sdk::c_datamodel>       datamodel = nullptr;
    static inline std::shared_ptr<sdk::c_players>         players = nullptr;
    static inline std::shared_ptr<sdk::c_visual_engine>   visual_engine = nullptr;
    static inline std::shared_ptr<sdk::c_workspace>       workspace = nullptr;
    static inline std::shared_ptr<sdk::c_camera>          camera = nullptr;
    static inline std::shared_ptr<sdk::c_mouse_service>   mouse_service = nullptr;
    static inline std::shared_ptr<sdk::c_instance>       lighting = nullptr;
    // General settings
    static inline bool                                     local_player_check = true;
    static inline bool                                     team_check = false;
    static inline float                                    camera_fov = 90;
    static inline bool                                     performance_mode = false;
    static inline bool                                     wallcheck = false;
    static inline int                                      wallcheck_interval = 5;
    
    // Wallcheck colors for different ESP elements
    static inline ImColor                                  wallcheck_visible_color = ImColor(0, 255, 0, 255);    // Green for visible
    static inline ImColor                                  wallcheck_hidden_color = ImColor(255, 0, 0, 255);    // Red for hidden
    
    // Separate wallcheck settings
    static inline bool                                     aimbot_wallcheck = false;
    static inline bool                                     visual_wallcheck = false;
    static inline bool                                     triggerbot_wallcheck = false;
    static inline bool                                     silent_aim_wallcheck = false;
    
    // Wallcheck configuration constants
    static inline float                                    wallcheck_min_partsize = 0.15f;
    static inline float                                    wallcheck_ray_depth = 0.8f;
    static inline float                                    wallcheck_ray_directory = 1e-6f;
    static inline float                                    wallcheck_cache_update_wait = 120.0f;
    static inline int                                      wallcheck_max_rays_perframe = 8;
    static inline float                                    wallcheck_vis_distance = 500.0f;
    
    // Wallcheck advanced settings
    static inline bool                                     wallcheck_debug_mode = false;
    static inline bool                                     wallcheck_force_refresh = false;
    static inline int                                      wallcheck_max_parts_checked = 150;
    static inline float                                    wallcheck_min_volume_threshold = 0.01f;
    static inline float                                    wallcheck_transparency_threshold = 0.9f;
    static inline bool                                     wallcheck_skip_player_parts = true;
    static inline bool                                     wallcheck_skip_transparent = true;
    
    // Map change detection for wallcheck
    static inline std::string                             current_map_name = "";
    static inline std::uint64_t                           current_map_address = 0;
    static inline bool                                    map_changed = false;
    static inline double                                   last_map_check_time = 0.0;
    static inline bool                                     keybind_list_enabled = true;
    static inline int                                      keybind_list_position = 1; // 0-5 for different positions
    static inline bool                                     streamer_mode = false;

    // Player list settings
    static inline bool                                     player_list_enabled = false;
    static inline Widgets::Hotkey                         player_list_keybind = Widgets::Hotkey("player_list_key");
    static inline std::vector<std::string>                whitelisted_players;
    static inline int                                      selected_player_index = -1;
    
    // Force recompilation - player list variables added

    static inline float lighting_brightness = 1.0f;
    static inline float lighting_fog_start = 0.0f;
    static inline float lighting_fog_end = 100.0f;
    static inline ImVec4 lighting_fog_color = ImVec4(0.7f, 0.7f, 0.7f, 1.0f);
    static inline ImVec4 lighting_color_shift_top = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4 lighting_color_shift_bottom = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4 lighting_ambient = ImVec4(0.5f, 0.5f, 0.5f, 1.0f);
    static inline ImVec4 lighting_outdoor_ambient = ImVec4(0.5f, 0.5f, 0.5f, 1.0f);

    // Aimlock settings
    static inline bool                                     aimlock_enabled = false;
    static inline bool                                     aimlock_sticky_aim = true;
    static inline int                                      aimlock_mode = 0;
    static inline int                                      aimlock_target_part = 0;
    static inline Widgets::Hotkey                         aimlock_keybind = Widgets::Hotkey("aimlock_key");
    static inline entity* aimlock_current_target = nullptr;
    static inline float                                    aimlock_fov = 100.0f;
    static inline bool                                     aimlock_smoothing_enabled = false;
    static inline int                                      aimlock_smoothness = 0;
    static inline int                                      aimlock_easing_style = 0;
    static inline int                                      aimlock_targeting_mode = 1;
    static inline float                                    aimlock_fov_size = 10.0f;
    static inline bool                                     aimlock_fov_visible = false;
    static inline ImVec4                                   aimlock_fov_color = ImVec4(1.0f, 1.0f, 1.0f, 0.3f);
    static inline bool                                     aimlock_fov_filled = false;
    static inline bool                                     aimlock_fov_outline = true;
    static inline float                                    aimlock_max_distance = 1000.0f;
    static inline bool                                     aimlock_distance_limit = true;
    static inline bool                                     aimlock_prediction = false;
    static inline float                                    aimlock_prediction_x = 1.0f;
    static inline float                                    aimlock_prediction_y = 1.0f;
    static inline float                                    aimlock_prediction_z = 1.0f;
    
    // Enhanced smoothing settings
    static inline float                                    aimlock_smoothing_x = 0.1f;
    static inline float                                    aimlock_smoothing_y = 0.1f;
    static inline int                                      aimlock_smoothing_type = 0; // 0 = normal, 1 = x/y separate
    static inline bool                                     aimlock_offset_enabled = false;
    static inline float                                    aimlock_offset_x = 0.0f;
    static inline float                                    aimlock_offset_y = 0.0f;
    static inline bool                                     aimlock_ground_detection = false;
    static inline bool                                     aimlock_shaking_enabled = false;
    static inline float                                    aimlock_shaking_intensity = 1.0f;
    
    // Force recompilation - enhanced smoothing variables added

    // Silent aim settings
    static inline bool                                     silent_aim_enabled = false;
    
    // Triggerbot settings
    static inline bool                                     triggerbot_enabled = false;
    static inline float                                    triggerbot_fov = 90.0f;
    static inline Widgets::Hotkey                          triggerbot_keybind = Widgets::Hotkey("triggerbot_key");
    static inline bool                                     triggerbot_fov_visible = false;
    static inline ImColor                                  triggerbot_fov_color = ImColor(255, 255, 255, 100);
    static inline bool                                     triggerbot_fov_filled = false;
    static inline bool                                     triggerbot_fov_outline = true;
    static inline bool                                     silent_aim_sticky_aim = true;
    static inline int                                      silent_aim_target_part = 0;
    static inline Widgets::Hotkey                         silent_aim_keybind = Widgets::Hotkey("silent_aim_key");
    static inline entity* silent_aim_current_target = nullptr;
    static inline bool                                     silent_aim_local_player_check = true;
    static inline bool                                     silent_aim_team_check = true;
    static inline int                                      silent_aim_targeting_mode = 1;
    static inline float                                    silent_aim_fov_size = 10.0f;
    static inline bool                                     silent_aim_fov_visible = false;
    static inline ImVec4                                   silent_aim_fov_color = ImVec4(1.0f, 0.0f, 0.0f, 0.3f);
    static inline bool                                     silent_aim_fov_filled = false;
    static inline bool                                     silent_aim_fov_outline = true;
    static inline float                                    silent_aim_max_distance = 1000.0f;
    static inline bool                                     silent_aim_distance_limit = true;

    // World visuals
    static inline bool                                     world_visuals = false;
    static inline int                                      world_visuals_type = 0;

    // Desync visualizer
    static inline bool                                     desync_visualizer = false;
    static inline int                                      desync_ghost_count = 10;
    static inline int                                      desync_ghost_size = 6;
    static inline int                                      desync_ghost_alpha = 120;
    static inline bool                                     desync_ghost_outline = true;
    static inline ImVec4                                   desync_ghost_color = ImVec4(0.2f, 0.7f, 1.0f, 0.6f);
    static inline ImVec4                                   desync_ghost_outline_color = ImVec4(0.0f, 0.0f, 0.0f, 1.0f);
    static inline float                                    desync_ghost_lifetime = 2.0f;
    struct ghost_polygon_t { std::vector<ImVec2> points; double timestamp; };
    static inline std::vector<ghost_polygon_t>            desync_ghost_polys;

    // ESP settings
    static inline bool                                     box = false;
    static inline int                                      box_type = 0;
    static inline bool                                     chams = false;
    static inline int                                      chams_type = 0;
    static inline bool                                     health_bar = false;
    static inline bool                                     name_esp = false;
    static inline bool                                     distance_esp = false;
    static inline bool                                     skeleton_esp = false;
    static inline int                                      skeleton_type = 0;
    static inline bool                                     chams_glow = false;
    static inline bool                                     esp_draw_accessories = false; // Draw accessories in ESP bounding box
    static inline float                                    chams_glow_size = 6.0f;
    static inline float                                    chams_thickness = 1.5f;
    static inline ImVec4                                   chams_glow_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);

    // ESP colors
    static inline ImVec4                                   box_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4                                   skeleton_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4                                   chams_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4                                   chams_outline_color = ImVec4(0.7f, 0.7f, 0.7f, 1.0f);
    static inline ImVec4                                   visuals_visible_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline ImVec4                                   visuals_invisible_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    static inline bool                                     esp_max_distance_enabled = false;
    static inline float                                    esp_max_distance = 1000.0f;
    static inline bool                                     box_filled = false;
    static inline ImVec4                                   box_fill_color = ImVec4(1.0f, 1.0f, 1.0f, 0.3f);
    static inline bool                                     box_gradient = false;
    static inline ImVec4                                   box_gradient_color = ImVec4(1.0f, 0.0f, 0.0f, 1.0f);
    static inline bool                                     box_rainbow = false;
    static inline float                                    box_rainbow_speed = 1.0f;
    static inline float                                    box_thickness = 1.0f;
    static inline bool                                     box_glow = false;
    static inline float                                    box_glow_size = 2.0f;
    static inline bool                                     name_background = false;
    static inline ImVec4                                   name_bg_color = ImVec4(0.0f, 0.0f, 0.0f, 0.7f);
    static inline float                                    name_font_size = 1.0f;
    static inline bool                                     name_rainbow = false;
    static inline float                                    name_rainbow_speed = 1.0f;
    static inline bool                                     health_text = false;
    static inline bool                                     health_background = true;
    static inline ImVec4                                   health_bg_color = ImVec4(0.1f, 0.1f, 0.1f, 0.8f);
    static inline bool                                     health_gradient = true;
    static inline ImVec4                                   health_high_color = ImVec4(0.0f, 1.0f, 0.0f, 1.0f);
    static inline ImVec4                                   health_low_color = ImVec4(1.0f, 0.0f, 0.0f, 1.0f);
    static inline bool                                     health_animated = false;
    static inline float                                    skeleton_thickness = 1.5f;
    static inline bool                                     skeleton_rainbow = false;
    static inline float                                    skeleton_rainbow_speed = 1.0f;
    static inline bool                                     skeleton_glow = false;
    static inline float                                    skeleton_glow_size = 2.0f;
    static inline bool                                     chams_rainbow = false;
    static inline float                                    chams_rainbow_speed = 1.0f;
    static inline bool                                     chams_pulsing = false;
    static inline float                                    chams_pulse_speed = 2.0f;
    static inline float                                    chams_transparency = 0.7f;
    static inline bool                                     chams_clipper_outline = false; // Use clipper for outline rendering
    static inline float                                    chams_clipper_width = 2.0f; // Clipper outline width
    static inline ImVec4                                   chams_clipper_color = ImVec4(0.0f, 1.0f, 0.0f, 1.0f); // Clipper outline color
    static inline bool                                     distance_background = false;
    static inline ImVec4                                   distance_bg_color = ImVec4(0.0f, 0.0f, 0.0f, 0.7f);
    static inline ImVec4                                   distance_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);

    // Movement features
    static inline bool                                     fly = false;
    static inline float                                    fly_speed = 1.0f;
    static inline Widgets::Hotkey                         fly_keybind = Widgets::Hotkey("fly_key");

    static inline bool                                     spinbot = false;
    static inline float                                    spinbot_speed = 0.05f;
    static inline int                                      spinbot_type = 0;
    static inline Widgets::Hotkey                         spinbot_keybind = Widgets::Hotkey("spinbot_key");

    static inline bool                                     bhop = false;
    static inline float                                    bhop_speed = 1.00f;
    static inline float                                    bhop_max_speed = 100.0f;
    static inline int                                      bhop_type = 0;
    static inline Widgets::Hotkey                         bhop_keybind = Widgets::Hotkey("bhop_key");

    static inline bool                                     upside_down = false;
    static inline Widgets::Hotkey                         upside_down_keybind = Widgets::Hotkey("upside_down_key");

    // Hitbox features
    static inline bool                                     hitbox_expand = false;
    static inline int                                      hitbox_expand_part = 0;
    static inline std::vector<std::string>                hitbox_expand_parts;
    static inline float                                    hitbox_scale = 2.0f;
    static inline Widgets::Hotkey                         hitbox_expand_keybind = Widgets::Hotkey("hitbox_expand_key");

    // Animation features
    static inline bool                                     animation_override = false;
    static inline int                                      animation_type = 0;
    static inline char                                     custom_animation[128] = "http://www.roblox.com/asset/?id=idhere";
    static inline Widgets::Hotkey                         animation_override_keybind = Widgets::Hotkey("animation_override_key");

    // Desync features
    static inline bool                                     desync = false;
    static inline bool                                     sab_test = false;
    static inline int                                      desync_value = 1;
    static inline Widgets::Hotkey                         desync_keybind = Widgets::Hotkey("desync_key");

    // Camera features
    static inline bool                                     third_person = false;
    static inline float                                    third_person_distance = 6.0f;
    static inline float                                    third_person_height = 2.0f;
    static inline Widgets::Hotkey                         third_person_keybind = Widgets::Hotkey("third_person_key");

    // Jump power features
    static inline bool                                     jumppower = false;
    static inline float                                    jumppower_value = 50.0f;
    static inline int                                      jumppower_method = 0; // 0=jumppower, 1=velocity, 2=cframe
    static inline Widgets::Hotkey                         jumppower_keybind = Widgets::Hotkey("jumppower_key");

    // Walk speed features
    static inline bool                                     walkspeed = false;
    static inline float                                    walkspeed_value = 16.0f;
    static inline int                                      walkspeed_method = 0; // 0=walkspeed, 1=velocity, 2=cframe
    static inline Widgets::Hotkey                         walkspeed_keybind = Widgets::Hotkey("walkspeed_key");
    
    // Force recompilation - new exploits added
};

inline std::unique_ptr<c_globals> globals = std::make_unique<c_globals>();