#include "cache.hpp"
#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/sdk/classes/c_primitives.hpp>
#include <source/framework/globals/globals.hpp>
#include <source/utils/memory/memory.hpp>
#include <set>
#include <future>
#include <thread>
#include <chrono>
#include <mutex>
#include <atomic>
#include <algorithm>

std::string entity::get_name() const
{
    try {
        if (!plr_address) return "";
        auto player = std::make_shared<sdk::c_instance>(plr_address);
        if (!player) return "";
        return player->get_name();
    }
    catch (...) {
        return "";
    }
}

std::shared_ptr<sdk::c_instance> entity::get_character() const
{
    try {
        if (!plr_modelinstance) return nullptr;
        auto character = std::make_shared<sdk::c_instance>(plr_modelinstance);
        return character;
    }
    catch (...) {
        return nullptr;
    }
}

player_part::player_part(std::shared_ptr<sdk::c_instance> inst, e_part_type part_type)
    : instance(inst), type(part_type), name("NULL"), class_name("NULL")
{
    try {
        if (inst && inst->address) {
            name = inst->get_name();
            class_name = inst->get_class_name();
            primitive = std::make_shared<sdk::c_primitives>(inst->address);
        }
    }
    catch (...) {
        name = "NULL";
        class_name = "NULL";
        primitive = nullptr;
    }
}

std::shared_ptr<sdk::c_primitives> entity::get_part(const std::string& name) const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            if (part.name == name) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

// Legacy method - now returns drawable parts for backward compatibility
std::vector<std::shared_ptr<sdk::c_primitives>> entity::get_all_parts() const
{
    return get_drawable_parts();
}

// New method to get part by class name
std::shared_ptr<sdk::c_primitives> entity::get_part_by_class(const std::string& class_name) const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            if (part.class_name == class_name) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

// Get specific important parts
std::shared_ptr<sdk::c_primitives> entity::get_head() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            if (part.name == "Head" && (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_torso() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if ((name == "Torso" || name == "UpperTorso") &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_humanoid_root_part() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            if (part.name == "HumanoidRootPart" &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_left_arm() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if ((name == "Left Arm" || name == "LeftUpperArm") &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_right_arm() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if ((name == "Right Arm" || name == "RightUpperArm") &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_left_leg() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if ((name == "Left Leg" || name == "LeftUpperLeg") &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_right_leg() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if ((name == "Right Leg" || name == "RightUpperLeg") &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_left_foot() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if (name == "LeftFoot" &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

std::shared_ptr<sdk::c_primitives> entity::get_right_foot() const
{
    try {
        // Check if all_parts is valid
        if (all_parts.size() > 10000) {
            return nullptr;
        }
        
        for (const auto& part : all_parts) {
            std::string name = part.name;
            if (name == "RightFoot" &&
                (part.class_name == "Part" || part.class_name == "MeshPart")) {
                if (part.primitive && part.primitive->address) {
                    return part.primitive;
                }
            }
        }
    }
    catch (...) {
        // Handle any exceptions during iteration
    }
    return nullptr;
}

// Categorize parts into different collections
void entity::categorize_parts()
{
    try {
        hitbox_parts.clear();
        drawable_parts.clear();
        accessory_parts.clear();

        for (const auto& part : all_parts) {
            if (!part.instance || !part.primitive) continue;

            switch (part.type) {
                case e_part_type::hitbox:
                    hitbox_parts.push_back(part.primitive);
                    drawable_parts.push_back(part.primitive); // Hitbox parts are also drawable
                    break;
                case e_part_type::accessory:
                    accessory_parts.push_back(part.primitive);
                    drawable_parts.push_back(part.primitive); // Accessories are also drawable
                    break;
                case e_part_type::other:
                    // Only add parts that are actually drawable (visible geometric parts)
                    if (part.class_name == "Part" || part.class_name == "MeshPart" ||
                        part.class_name == "UnionOperation" || part.class_name == "NegateOperation")
                    {
                        drawable_parts.push_back(part.primitive);
                    }
                    break;
            }
        }
    }
    catch (...) {
        // Handle any exceptions during categorization
        hitbox_parts.clear();
        drawable_parts.clear();
        accessory_parts.clear();
    }
}

// Determine part type based on name and class
e_part_type entity::get_part_type(const std::string& part_name, const std::string& class_name) const
{
    // Check if it's a hitbox part
    if (part_name == "Head" || part_name == "Torso" || part_name == "UpperTorso" ||
        part_name == "LowerTorso" || part_name == "Left Arm" || part_name == "Right Arm" ||
        part_name == "Left Leg" || part_name == "Right Leg" ||
        part_name == "LeftUpperArm" || part_name == "RightUpperArm" ||
        part_name == "LeftUpperLeg" || part_name == "RightUpperLeg" ||
        part_name == "LeftLowerArm" || part_name == "RightLowerArm" ||
        part_name == "LeftLowerLeg" || part_name == "RightLowerLeg" ||
        part_name == "HumanoidRootPart")
    {
        return e_part_type::hitbox;
    }

    // Check if it's an accessory
    if (part_name == "Handle" || part_name == "Mesh" ||
        class_name == "Accessory" || class_name == "Hat" ||
        class_name == "Tool" || class_name == "MeshPart")
    {
        return e_part_type::accessory;
    }

    return e_part_type::other;
}

float entity::get_health() const
{
    try {
        if (!plr_modelinstance) return 0.0f;

        auto character = std::make_shared<sdk::c_instance>(plr_modelinstance);
        if (!character) return 0.0f;
        
        auto humanoid = character->find_first_child("Humanoid");
        if (!humanoid) return 0.0f;

        return g_memory->read<float>(humanoid->address + sdk::offsets::humanoid::health);
    }
    catch (...) {
        return 0.0f;
    }
}

float entity::get_max_health() const
{
    try {
        if (!plr_modelinstance) return 0.0f;
        
        auto character = std::make_shared<sdk::c_instance>(plr_modelinstance);
        if (!character) return 0.0f;
        
        auto humanoid = character->find_first_child("Humanoid");
        if (!humanoid) return 0.0f;
        
        return g_memory->read<float>(humanoid->address + sdk::offsets::humanoid::max_health);
    }
    catch (...) {
        return 0.0f;
    }
}

// Background thread function
void features::c_cache::start_background_updates()
{
    should_stop = false;
    background_thread = std::thread([this]() {
        while (!should_stop) {
            auto now = std::chrono::steady_clock::now();
            if (now - last_update >= UPDATE_INTERVAL) {
                update_async();
                last_update = now;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(1)); // Small sleep to prevent CPU spinning
        }
        });
}

void features::c_cache::stop_background_updates()
{
    should_stop = true;
    if (background_thread.joinable()) {
        background_thread.join();
    }
}

// Async update that doesn't block main thread
void features::c_cache::update_async()
{
    // Skip if already updating
    if (update_in_progress.exchange(true)) {
        return;
    }

    // Use async task for the actual work
    auto update_task = std::async(std::launch::async, [this]() {
        try {
            // Don't return early, just skip operations if invalid
            if (!globals || !globals->datamodel) {
                std::lock_guard<std::mutex> lock(entities_mutex);
                entities.clear();
                update_in_progress = false;
                return;
            }

            // Detect Phantom Forces and custom games
            try {
                current_place_id = globals->datamodel->get_game_id();
                is_phantom_forces = std::find(custom_games.begin(), custom_games.end(), current_place_id) != custom_games.end();
                
                // Debug output
              //  printf("[CACHE DEBUG] Place ID: %llu, Is Phantom Forces: %s\n", 
               //        current_place_id, is_phantom_forces ? "YES" : "NO");
            }
            catch (...) {
                current_place_id = 0;
                is_phantom_forces = false;
             //   printf("[CACHE DEBUG] Failed to detect game type, using standard mode\n");
            }

            std::vector<std::shared_ptr<sdk::c_player>> playerlist;

            if (is_phantom_forces) {
                // Use custom game player enumeration
              //  printf("[CACHE DEBUG] Using Phantom Forces player enumeration\n");
                auto custom_players = get_custom_game_players();
             //   printf("[CACHE DEBUG] Found %zu custom game players\n", custom_players.size());
                
                for (auto& player_instance : custom_players) {
                    if (player_instance && player_instance->address) {
                        // For Phantom Forces, create a special player object that treats the model as the character
                        auto player_obj = std::make_shared<sdk::c_player>(player_instance->address);
                        playerlist.push_back(player_obj);
                    //    printf("[CACHE DEBUG] Added Phantom Forces player: %s\n", player_instance->get_name().c_str());
                    }
                }
            }
            else {
                // Use standard Roblox player enumeration
               // printf("[CACHE DEBUG] Using standard Roblox player enumeration\n");
            auto players_service = globals->datamodel->find_first_child_of_class("Players");
            if (!players_service) {
                  //  printf("[CACHE DEBUG] Players service not found!\n");
                std::lock_guard<std::mutex> lock(entities_mutex);
                entities.clear();
                update_in_progress = false;
                return;
            }

            auto players_obj = std::make_shared<sdk::c_players>(players_service->address);

            try {
                playerlist = players_obj->get_players();
                   // printf("[CACHE DEBUG] Found %zu standard players\n", playerlist.size());
            }
            catch (...) {
                playerlist.clear();
               //     printf("[CACHE DEBUG] Failed to get standard players\n");
                }
            }

            if (playerlist.empty()) {
                std::lock_guard<std::mutex> lock(entities_mutex);
                entities.clear();
                update_in_progress = false;
                return;
            }

            // Process players in parallel chunks
            const size_t num_threads = std::min(static_cast<size_t>(4), playerlist.size()); // Max 4 threads
            const size_t chunk_size = playerlist.size() / num_threads;

            std::vector<std::future<std::vector<std::unique_ptr<entity>>>> futures;
            std::set<uintptr_t> current_player_addresses;

            // Collect current addresses
            for (auto& plr : playerlist) {
                if (plr && plr->address) {
                    current_player_addresses.insert(plr->address);
                }
            }

            // Process chunks in parallel
            for (size_t i = 0; i < num_threads; ++i) {
                size_t start = i * chunk_size;
                size_t end = (i == num_threads - 1) ? playerlist.size() : start + chunk_size;

                futures.push_back(std::async(std::launch::async, [this, &playerlist, start, end]() {
                    std::vector<std::unique_ptr<entity>> chunk_entities;

                    for (size_t j = start; j < end; ++j) {
                        auto& plr = playerlist[j];
                        if (!plr || !plr->address) continue;

                        auto ent = std::make_unique<entity>();
                        ent->plr_address = plr->address;
                        ent->plr_modelinstance = 0;
                        ent->alive = false;

                        auto character = plr->get_character();
                        if (character && character->address) {
                            ent->plr_modelinstance = character->address;
                            //printf("[CACHE DEBUG] Processing character for player: %s\n", plr->get_name().c_str());
                            try {
                                auto children = character->get_children();
                              // printf("[CACHE DEBUG] Character has %zu children\n", children.size());
                                
                                // For Phantom Forces, if character has no children, use the player model directly
                                if (is_phantom_forces && children.empty()) {
                                   // printf("[CACHE DEBUG] Phantom Forces: Using player model directly as character\n");
                                    auto player_instance = std::make_shared<sdk::c_instance>(plr->address);
                                    children = player_instance->get_children();
                                   // printf("[CACHE DEBUG] Player model has %zu children\n", children.size());
                                }

                                // Populate all_parts with proper categorization
                                for (const auto& child : children) {
                                    if (!child || !child->address) continue;

                                    std::string part_name = child->get_name();
                                    std::string class_name = child->get_class_name();
                                    
                                   //printf("[CACHE DEBUG] Processing child: %s (%s)\n", part_name.c_str(), class_name.c_str());

                                    // Skip non-physical parts that aren't useful for gameplay
                                    if (class_name == "Script" || class_name == "LocalScript" ||
                                        class_name == "ModuleScript" || class_name == "Humanoid" ||
                                        class_name == "Animator" || class_name == "BodyGyro" ||
                                        class_name == "BodyPosition" || class_name == "BodyVelocity" ||
                                        class_name == "BasePart" || // Skip abstract BasePart class
                                        class_name == "NULL" || class_name.empty()) {
                                        continue;
                                    }

                                    // Special handling for Phantom Forces and custom games
                                    if (is_phantom_forces) {
                                        // For Phantom Forces, handle nested structure
                                        if (current_place_id == 2746687316) {
                                            // Handle nested folder structure
                                            if (class_name == "Folder") {
                                                auto folder_children = child->get_children();
                                                for (auto& folder_child : folder_children) {
                                                    if (!folder_child || !folder_child->address) continue;
                                                    
                                                    std::string folder_child_name = folder_child->get_name();
                                                    std::string folder_child_class = folder_child->get_class_name();
                                                    
                                                    if (folder_child_class == "MeshPart" || folder_child_class == "Part") {
                                                        if (folder_child_name != "HumanoidRootPart") {
                                                            e_part_type part_type = ent->get_part_type(folder_child_name, folder_child_class);
                                                            ent->all_parts.emplace_back(folder_child, part_type);
                                                        }
                                                    }
                                                }
                                            }
                                            else if (class_name == "MeshPart" || class_name == "Part") {
                                                if (part_name != "HumanoidRootPart") {
                                                    e_part_type part_type = ent->get_part_type(part_name, class_name);
                                                    ent->all_parts.emplace_back(child, part_type);
                                                }
                                            }
                                        }
                                        else {
                                            // Standard Phantom Forces handling - filter out gun parts
                                            if (class_name == "Part" || class_name == "MeshPart") {
                                                // Skip gun-related parts that have recognizable names
                                                if (part_name.find("AK12") != std::string::npos ||
                                                    part_name.find("Stock") != std::string::npos ||
                                                    part_name.find("Barrel") != std::string::npos ||
                                                    part_name.find("Detail") != std::string::npos ||
                                                    part_name.find("MeshPart") != std::string::npos ||
                                                    part_name.find("Trigger") != std::string::npos ||
                                                    part_name.find("Bolt") != std::string::npos ||
                                                    part_name.find("Mag") != std::string::npos ||
                                                    part_name.find("Sight") != std::string::npos ||
                                                    part_name.find("Iron") != std::string::npos ||
                                                    part_name.find("Flame") != std::string::npos ||
                                                    part_name.find("Engraving") != std::string::npos ||
                                                    part_name.find("Lens") != std::string::npos ||
                                                    part_name.find("Mount") != std::string::npos ||
                                                    part_name.find("Main") != std::string::npos ||
                                                    part_name.find("INTERVENTION") != std::string::npos) {
                                                    continue; // Skip gun parts
                                                }
                                                
                                                // Only include parts that are likely body parts (encrypted names)
                                                e_part_type part_type = e_part_type::other; // Treat as drawable part
                                                ent->all_parts.emplace_back(child, part_type);
                                            }
                                        }
                                        
                                        // Handle accessories for Phantom Forces
                                        if (class_name == "Accessory" || class_name == "Hat") {
                                            auto handle_mesh_part = child->find_first_child_of_class("MeshPart");
                                            auto handle_part = child->find_first_child_of_class("Part");
                                            
                                            if (handle_mesh_part && handle_mesh_part->address && handle_mesh_part->get_name() == "Handle") {
                                                e_part_type part_type = ent->get_part_type("Handle", "MeshPart");
                                                ent->all_parts.emplace_back(handle_mesh_part, part_type);
                                            }
                                            
                                            if (handle_part && handle_part->address && handle_part->get_name() == "Handle") {
                                                e_part_type part_type = ent->get_part_type("Handle", "Part");
                                                ent->all_parts.emplace_back(handle_part, part_type);
                                            }
                                        }
                                        
                                        // Handle Accessories folder
                                        if (class_name == "Folder" && part_name == "Accessories") {
                                            auto accessory_children = child->get_children();
                                            for (auto& accessory : accessory_children) {
                                                if (!accessory || !accessory->address) continue;
                                                if (accessory->get_class_name() == "Accessory" || accessory->get_class_name() == "Hat") {
                                                    auto handle_mesh_part = accessory->find_first_child_of_class("MeshPart");
                                                    auto handle_part = accessory->find_first_child_of_class("Part");
                                                    
                                                    if (handle_mesh_part && handle_mesh_part->address && handle_mesh_part->get_name() == "Handle") {
                                                        e_part_type part_type = ent->get_part_type("Handle", "MeshPart");
                                                        ent->all_parts.emplace_back(handle_mesh_part, part_type);
                                                    }
                                                    
                                                    if (handle_part && handle_part->address && handle_part->get_name() == "Handle") {
                                                        e_part_type part_type = ent->get_part_type("Handle", "Part");
                                                        ent->all_parts.emplace_back(handle_part, part_type);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        // Standard Roblox handling
                                        if (part_name == "HumanoidRootPart") continue;
                                        
                                        if (class_name == "Part" || class_name == "MeshPart") {
                                            e_part_type part_type = ent->get_part_type(part_name, class_name);
                                            ent->all_parts.emplace_back(child, part_type);
                                        }
                                        
                                        // Handle accessories for standard games
                                        if (class_name == "Accessory" || class_name == "Hat") {
                                            auto handle_mesh_part = child->find_first_child_of_class("MeshPart");
                                            auto handle_part = child->find_first_child_of_class("Part");
                                            
                                            if (handle_mesh_part && handle_mesh_part->address && handle_mesh_part->get_name() == "Handle") {
                                                e_part_type part_type = ent->get_part_type("Handle", "MeshPart");
                                                ent->all_parts.emplace_back(handle_mesh_part, part_type);
                                            }
                                            
                                            if (handle_part && handle_part->address && handle_part->get_name() == "Handle") {
                                                e_part_type part_type = ent->get_part_type("Handle", "Part");
                                                ent->all_parts.emplace_back(handle_part, part_type);
                                            }
                                        }
                                    }
                                }

                                // Categorize parts into organized collections for quick access
                                ent->categorize_parts();
                               // printf("[CACHE DEBUG] Player %s has %zu total parts, %zu hitbox parts, %zu drawable parts\n", 
                                //       plr->get_name().c_str(), ent->all_parts.size(), ent->hitbox_parts.size(), ent->drawable_parts.size());

                                // Check if player is alive (has any body parts in Phantom Forces)
                                ent->alive = !ent->all_parts.empty();
                              //  printf("[CACHE DEBUG] Player %s alive status: %s\n", plr->get_name().c_str(), ent->alive ? "YES" : "NO");
                            }
                            catch (...) {
                                ent->all_parts.clear();
                                ent->hitbox_parts.clear();
                                ent->drawable_parts.clear();
                                ent->accessory_parts.clear();
                                ent->alive = false;
                            }
                        }
                        else if (is_phantom_forces) {
                            // For Phantom Forces, if no character found, use the player model directly
                           // printf("[CACHE DEBUG] Phantom Forces: No character found, using player model directly\n");
                            ent->plr_modelinstance = plr->address;
                            try {
                                auto player_instance = std::make_shared<sdk::c_instance>(plr->address);
                                auto children = player_instance->get_children();
                              //  printf("[CACHE DEBUG] Player model has %zu children\n", children.size());
                                
                                // Process children the same way as character children
                                for (const auto& child : children) {
                                    if (!child || !child->address) continue;

                                    std::string part_name = child->get_name();
                                    std::string class_name = child->get_class_name();
                                    
                                  //  printf("[CACHE DEBUG] Processing child: %s (%s)\n", part_name.c_str(), class_name.c_str());

                                    // Skip non-physical parts that aren't useful for gameplay
                                    if (class_name == "Script" || class_name == "LocalScript" ||
                                        class_name == "ModuleScript" || class_name == "Humanoid" ||
                                        class_name == "Animator" || class_name == "BodyGyro" ||
                                        class_name == "BodyPosition" || class_name == "BodyVelocity" ||
                                        class_name == "BasePart" || // Skip abstract BasePart class
                                        class_name == "NULL" || class_name.empty()) {
                                        continue;
                                    }

                                    // Phantom Forces body part handling - filter out gun parts
                                    if (class_name == "Part" || class_name == "MeshPart") {
                                        // Skip gun-related parts that have recognizable names
                                        if (part_name.find("AK12") != std::string::npos ||
                                            part_name.find("Stock") != std::string::npos ||
                                            part_name.find("Barrel") != std::string::npos ||
                                            part_name.find("Detail") != std::string::npos ||
                                            part_name.find("MeshPart") != std::string::npos ||
                                            part_name.find("Trigger") != std::string::npos ||
                                            part_name.find("Bolt") != std::string::npos ||
                                            part_name.find("Mag") != std::string::npos ||
                                            part_name.find("Sight") != std::string::npos ||
                                            part_name.find("Iron") != std::string::npos ||
                                            part_name.find("Flame") != std::string::npos ||
                                            part_name.find("Engraving") != std::string::npos ||
                                            part_name.find("Lens") != std::string::npos ||
                                            part_name.find("Mount") != std::string::npos ||
                                            part_name.find("Main") != std::string::npos ||
                                            part_name.find("INTERVENTION") != std::string::npos) {
                                            continue; // Skip gun parts
                                        }
                                        
                                        // Only include parts that are likely body parts (encrypted names)
                                        // Body parts in PF typically have encrypted names like "E6VuVi_2", "Ycbl?v", etc.
                                        e_part_type part_type = e_part_type::other; // Treat as drawable part
                                        ent->all_parts.emplace_back(child, part_type);
                                    }
                                    
                                    // Check if this is a Model that might contain body parts
                                    if (class_name == "Model") {
                                     //   printf("[CACHE DEBUG] Found model: %s, checking for body parts\n", part_name.c_str());
                                        auto model_children = child->get_children();
                                        for (const auto& model_child : model_children) {
                                            if (!model_child || !model_child->address) continue;
                                            
                                            std::string model_child_name = model_child->get_name();
                                            std::string model_child_class = model_child->get_class_name();
                                            
                                          //  printf("[CACHE DEBUG] Processing model child: %s (%s)\n", model_child_name.c_str(), model_child_class.c_str());
                                            
                                            if (model_child_class == "Part" || model_child_class == "MeshPart") {
                                                // Skip gun-related parts
                                                if (model_child_name.find("AK12") != std::string::npos ||
                                                    model_child_name.find("Stock") != std::string::npos ||
                                                    model_child_name.find("Barrel") != std::string::npos ||
                                                    model_child_name.find("Detail") != std::string::npos ||
                                                    model_child_name.find("MeshPart") != std::string::npos ||
                                                    model_child_name.find("Trigger") != std::string::npos ||
                                                    model_child_name.find("Bolt") != std::string::npos ||
                                                    model_child_name.find("Mag") != std::string::npos ||
                                                    model_child_name.find("Sight") != std::string::npos ||
                                                    model_child_name.find("Iron") != std::string::npos ||
                                                    model_child_name.find("Flame") != std::string::npos ||
                                                    model_child_name.find("Engraving") != std::string::npos ||
                                                    model_child_name.find("Lens") != std::string::npos ||
                                                    model_child_name.find("Mount") != std::string::npos ||
                                                    model_child_name.find("Main") != std::string::npos ||
                                                    model_child_name.find("INTERVENTION") != std::string::npos) {
                                                    continue; // Skip gun parts
                                                }
                                                
                                                // Add body parts from nested models
                                                e_part_type part_type = e_part_type::other;
                                                ent->all_parts.emplace_back(model_child, part_type);
                                            }
                                        }
                                    }
                                    
                                    // Handle accessories for Phantom Forces
                                    if (class_name == "Accessory" || class_name == "Hat") {
                                        auto handle_mesh_part = child->find_first_child_of_class("MeshPart");
                                        auto handle_part = child->find_first_child_of_class("Part");
                                        
                                        if (handle_mesh_part && handle_mesh_part->address && handle_mesh_part->get_name() == "Handle") {
                                            e_part_type part_type = ent->get_part_type("Handle", "MeshPart");
                                            ent->all_parts.emplace_back(handle_mesh_part, part_type);
                                        }
                                        
                                        if (handle_part && handle_part->address && handle_part->get_name() == "Handle") {
                                            e_part_type part_type = ent->get_part_type("Handle", "Part");
                                            ent->all_parts.emplace_back(handle_part, part_type);
                                        }
                                    }
                                }
                                
                                // Categorize parts into organized collections for quick access
                                ent->categorize_parts();
                                //printf("[CACHE DEBUG] Player %s has %zu total parts, %zu hitbox parts, %zu drawable parts\n", 
                                 //      plr->get_name().c_str(), ent->all_parts.size(), ent->hitbox_parts.size(), ent->drawable_parts.size());

                                // Check if player is alive (has any body parts in Phantom Forces)
                                ent->alive = !ent->all_parts.empty();
                               // printf("[CACHE DEBUG] Player %s alive status: %s\n", plr->get_name().c_str(), ent->alive ? "YES" : "NO");
                            }
                            catch (...) {
                                ent->all_parts.clear();
                                ent->hitbox_parts.clear();
                                ent->drawable_parts.clear();
                                ent->accessory_parts.clear();
                                ent->alive = false;
                            }
                        }

                        chunk_entities.push_back(std::move(ent));
                    }

                    return chunk_entities;
                    }));
            }

            // Collect results from all threads
            std::vector<std::unique_ptr<entity>> new_entities;
            for (auto& future : futures) {
                try {
                    auto chunk = future.get();
                    new_entities.insert(new_entities.end(),
                        std::make_move_iterator(chunk.begin()),
                        std::make_move_iterator(chunk.end()));
                }
                catch (...) {
                    // Handle thread exceptions gracefully
                }
            }

            // Update the main entities list (quick lock)
            {
                std::lock_guard<std::mutex> lock(entities_mutex);

                // Remove invalid entities
                entities.erase(
                    std::remove_if(entities.begin(), entities.end(),
                        [&current_player_addresses](const std::unique_ptr<entity>& e) {
                            return !e || !e->plr_address ||
                                current_player_addresses.find(e->plr_address) == current_player_addresses.end();
                        }),
                    entities.end()
                );
                
                //printf("[CACHE DEBUG] Cache update complete. Total entities: %zu\n", entities.size());

                // Merge new entities with existing ones
                for (auto& new_ent : new_entities) {
                    auto it = std::find_if(entities.begin(), entities.end(),
                        [&new_ent](const std::unique_ptr<entity>& e) {
                            return e && e->plr_address == new_ent->plr_address;
                        });

                    if (it != entities.end()) {
                        // Update existing entity
                        (*it)->plr_modelinstance = new_ent->plr_modelinstance;
                        (*it)->all_parts = std::move(new_ent->all_parts);
                        (*it)->hitbox_parts = std::move(new_ent->hitbox_parts);
                        (*it)->drawable_parts = std::move(new_ent->drawable_parts);
                        (*it)->accessory_parts = std::move(new_ent->accessory_parts);
                        (*it)->alive = new_ent->alive;
                    }
                    else {
                        // Add new entity
                        entities.push_back(std::move(new_ent));
                    }
                }
            }
        }
        catch (...) {
            // Handle any unexpected exceptions
        }

        update_in_progress = false;
        });
}

// Original update method for fallback/manual updates
void features::c_cache::update()
{
    update_async();
}

std::vector<entity*> features::c_cache::get_alive_entities()
{
    try {
        std::lock_guard<std::mutex> lock(entities_mutex);
        std::vector<entity*> alive_ents;
        for (auto& ent : entities) {
            if (ent && ent->alive) {
                alive_ents.push_back(ent.get());
            }
        }
        return alive_ents;
    }
    catch (...) {
        return std::vector<entity*>();
    }
}

entity* features::c_cache::find_by_name(const std::string& name)
{
    try {
        std::lock_guard<std::mutex> lock(entities_mutex);
        for (auto& ent : entities) {
            if (ent && ent->get_name() == name) {
                return ent.get();
            }
        }
    }
    catch (...) {
        // Handle any exceptions during search
    }
    return nullptr;
}

// Add the missing method implementations if they exist in your header
std::vector<entity*> features::c_cache::get_healthy_entities()
{
    try {
        std::lock_guard<std::mutex> lock(entities_mutex);
        std::vector<entity*> healthy_ents;
        for (auto& ent : entities) {
            if (ent && ent->alive && ent->get_health() > 0) {
                healthy_ents.push_back(ent.get());
            }
        }
        return healthy_ents;
    }
    catch (...) {
        return std::vector<entity*>();
    }
}

// New convenience methods for working with categorized parts
std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_hitbox_parts()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_hitboxes;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto hitboxes = ent->get_hitbox_parts();
            all_hitboxes.insert(all_hitboxes.end(), hitboxes.begin(), hitboxes.end());
        }
    }
    return all_hitboxes;
}

std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_drawable_parts()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_drawables;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto drawables = ent->get_drawable_parts();
            all_drawables.insert(all_drawables.end(), drawables.begin(), drawables.end());
        }
    }
    return all_drawables;
}

std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_accessory_parts()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_accessories;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto accessories = ent->get_accessory_parts();
            all_accessories.insert(all_accessories.end(), accessories.begin(), accessories.end());
        }
    }
    return all_accessories;
}

std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_heads()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_heads;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto head = ent->get_head();
            if (head)
                all_heads.push_back(head);
        }
    }
    return all_heads;
}

std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_torsos()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_torsos;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto torso = ent->get_torso();
            if (torso)
                all_torsos.push_back(torso);
        }
    }
    return all_torsos;
}

std::vector<std::shared_ptr<sdk::c_primitives>> features::c_cache::get_all_humanoid_root_parts()
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    std::vector<std::shared_ptr<sdk::c_primitives>> all_roots;
    for (auto& ent : entities)
    {
        if (ent && ent->alive)
        {
            auto root = ent->get_humanoid_root_part();
            if (root)
                all_roots.push_back(root);
        }
    }
    return all_roots;
}

size_t features::c_cache::get_total_part_count() const
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    size_t total = 0;
    for (auto& ent : entities)
    {
        if (ent)
            total += ent->all_parts.size();
    }
    return total;
}

size_t features::c_cache::get_total_hitbox_count() const
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    size_t total = 0;
    for (auto& ent : entities)
    {
        if (ent)
            total += ent->hitbox_parts.size();
    }
    return total;
}

size_t features::c_cache::get_total_drawable_count() const
{
    std::lock_guard<std::mutex> lock(entities_mutex);
    size_t total = 0;
    for (auto& ent : entities)
    {
        if (ent)
            total += ent->drawable_parts.size();
    }
    return total;
}

// Phantom Forces Support Implementation
std::vector<std::shared_ptr<sdk::c_instance>> features::c_cache::get_phantom_forces_players()
{
    std::vector<std::shared_ptr<sdk::c_instance>> players;
    
    try {
      //  printf("[CACHE DEBUG] Starting Phantom Forces player enumeration\n");
        
        // Get Players folder
        auto players_folder = globals->workspace->find_first_child("Players");
        if (!players_folder || !players_folder->address) {
        //    printf("[CACHE DEBUG] Players folder not found in workspace!\n");
            return players;
        }
        
       // printf("[CACHE DEBUG] Found Players folder at address: %llu\n", players_folder->address);
        auto all_children = players_folder->get_children();
      //  printf("[CACHE DEBUG] Players folder has %zu children\n", all_children.size());
        
        for (size_t i = 0; i < all_children.size(); ++i) {
            if (i == 0) {
           //     printf("[CACHE DEBUG] Skipping first child (local player)\n");
                continue; // Skip first child (usually local player)
            }
            
            auto& child = all_children[i];
            if (!child || !child->address) continue;
            
        //    printf("[CACHE DEBUG] Processing team folder: %s (%s)\n", 
          //         child->get_name().c_str(), child->get_class_name().c_str());
            
            auto team_children = child->get_children();
        //    printf("[CACHE DEBUG] Team folder has %zu children\n", team_children.size());
            
            for (auto& player_folder : team_children) {
                if (!player_folder || !player_folder->address) continue;
                
              //  printf("[CACHE DEBUG] Processing player folder: %s (%s)\n", 
               //        player_folder->get_name().c_str(), player_folder->get_class_name().c_str());
                
                auto model = player_folder->find_first_child_of_class("Model");
                if (model && model->address) {
                    players.push_back(model);
                  //  printf("[CACHE DEBUG] Found player model: %s\n", model->get_name().c_str());
                }
                
                if (player_folder->get_class_name() == "Model") {
                    players.push_back(player_folder);
                 //   printf("[CACHE DEBUG] Player folder is itself a model: %s\n", player_folder->get_name().c_str());
                }
            }
        }
        
      //  printf("[CACHE DEBUG] Phantom Forces enumeration complete, found %zu players\n", players.size());
    }
    catch (...) {
     //   printf("[CACHE DEBUG] Exception in Phantom Forces player enumeration\n");
    }
    
    return players;
}

std::vector<std::shared_ptr<sdk::c_instance>> features::c_cache::get_custom_game_players()
{
    std::vector<std::shared_ptr<sdk::c_instance>> players;
    
    try {
     //   printf("[CACHE DEBUG] Getting custom game players for place ID: %llu\n", current_place_id);
        
        switch (current_place_id) {
        case 113491250: // Phantom Forces
        //    printf("[CACHE DEBUG] Detected Phantom Forces, using PF enumeration\n");
            return get_phantom_forces_players();
            
        case 2746687316: // Other custom game
         //   printf("[CACHE DEBUG] Detected other custom game, using Playermodels enumeration\n");
            {
                auto playermodels_folder = globals->workspace->find_first_child("Playermodels");
                if (!playermodels_folder || !playermodels_folder->address) {
                //    printf("[CACHE DEBUG] Playermodels folder not found!\n");
                    return players;
                }
                
              //  printf("[CACHE DEBUG] Found Playermodels folder at address: %llu\n", playermodels_folder->address);
                auto all_children = playermodels_folder->get_children();
               // printf("[CACHE DEBUG] Playermodels folder has %zu children\n", all_children.size());
                
                for (size_t i = 0; i < all_children.size(); ++i) {
                    auto& child = all_children[i];
                    if (!child || !child->address) continue;
                    
                    std::string child_name = child->get_name();
                    std::string child_class = child->get_class_name();
                    
                  //  printf("[CACHE DEBUG] Processing child: %s (%s)\n", child_name.c_str(), child_class.c_str());
                    
                    if (child_class == "Folder") {
                        auto model = child->find_first_child_of_class("Model");
                        if (model && model->address) {
                            players.push_back(model);
                          //  printf("[CACHE DEBUG] Found model in folder: %s\n", model->get_name().c_str());
                        }
                    }
                    else if (child_class == "Model") {
                        players.push_back(child);
                     //   printf("[CACHE DEBUG] Found direct model: %s\n", child->get_name().c_str());
                    }
                }
            }
            break;
            
        default:
         //   printf("[CACHE DEBUG] Unknown custom game ID: %llu\n", current_place_id);
            break;
        }
        
     //   printf("[CACHE DEBUG] Custom game enumeration complete, found %zu players\n", players.size());
    }
    catch (...) {
    //    printf("[CACHE DEBUG] Exception in custom game player enumeration\n");
    }
    
    return players;
}

std::vector<std::shared_ptr<sdk::c_instance>> features::c_cache::get_standard_players()
{
    std::vector<std::shared_ptr<sdk::c_instance>> players;
    
    try {
        auto players_service = globals->players;
        if (!players_service) return players;
        
        auto all_players = players_service->get_children();
        for (auto& player : all_players) {
            if (player && player->address) {
                players.push_back(player);
            }
        }
    }
    catch (...) {
        // Handle any exceptions gracefully
    }
    
    return players;
}