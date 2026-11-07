#include "entry.hpp"
#include <source/framework/features/cache/wallcheck/wallcheck.hpp>
#include <source/framework/features/functions/triggerbot/triggerbot.hpp>
#include <source/utils/console/console.hpp>

namespace features
{
    void refresh_globals()
    {
        try {
            if (!g_memory || !globals) {
                return;
            }

            uint64_t dm_ptr = g_memory->read<uint64_t>(globals->base + sdk::offsets::datamodel::pointer);
            
            if (!dm_ptr) {
                return;
            }

            uint64_t real_dm = g_memory->read<uint64_t>(dm_ptr + sdk::offsets::datamodel::realdatamodel);
            uint64_t visual_ptr = g_memory->read<uint64_t>(globals->base + sdk::offsets::visualengine::pointer);
            
            if (!real_dm || !visual_ptr) {
                return;
            }

            globals->datamodel = std::make_shared<sdk::c_datamodel>(real_dm);
            globals->visual_engine = std::make_shared<sdk::c_visual_engine>(visual_ptr);
            
            auto workspace = globals->datamodel->find_first_child_of_class("Workspace");
            auto players = globals->datamodel->find_first_child_of_class("Players");
            auto mouse_service = globals->datamodel->find_first_child_of_class("MouseService");
            auto lighting = globals->datamodel->find_first_child_of_class("Lighting");
            
            if (workspace && players && mouse_service) {
                globals->workspace = std::make_shared<sdk::c_workspace>(workspace->address);
                globals->players = std::make_shared<sdk::c_players>(players->address);
                globals->mouse_service = std::make_shared<sdk::c_mouse_service>(mouse_service->address);
                
                // Camera is accessed via offset, not as a child
                if (globals->workspace->address) {
                    uint64_t camera_addr = g_memory->read<uint64_t>(globals->workspace->address + sdk::offsets::workspace::camera);
                    
                    if (camera_addr) {
                        globals->camera = std::make_shared<sdk::c_camera>(camera_addr);
                    } else {
                    }
                } else {
                }
                
                // Lighting is optional, only assign if found
                if (lighting && lighting->address) {
                    globals->lighting = std::make_shared<sdk::c_instance>(lighting->address);
                } else {
                }
            } else {
            }
        }
        catch (...) {
            // swallow invalid reads safely
        }
    }

    void c_entry::initialize() 
    {
        DWORD process_id = 0;
        while (!(process_id = g_memory->get_process_id("RobloxPlayerBeta.exe")))
            std::this_thread::sleep_for(std::chrono::seconds(1));

        globals->pid = process_id;
        globals->handle = g_memory->get_process_handle("RobloxPlayerBeta.exe");
        globals->base = g_memory->get_process_base("RobloxPlayerBeta.exe");

        while (true)
        {
            refresh_globals();
            if (globals->datamodel && globals->datamodel->address &&
                globals->datamodel->get_class_name() == "DataModel" &&
                globals->datamodel->is_loaded() && globals->workspace &&
                globals->players && globals->camera && globals->visual_engine &&
                globals->workspace->address && globals->players->address &&
                globals->camera->address && globals->visual_engine->address)
                break;

            console->print(c_console::log_level::info, "waiting for game to load...");
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        }

        console->print(c_console::log_level::info, "starting cache");



        features::cache->start_background_updates();



        std::thread([] {
            while (true) {
                refresh_globals();
                features::exploits->initialize();

                std::this_thread::sleep_for(std::chrono::milliseconds(globals->performance_mode ? 1 : 5));
            }
            }).detach();

        std::thread([] {

            features::silent_aim->initialize();

            if (globals->performance_mode)
                std::this_thread::sleep_for(std::chrono::milliseconds(1));

            }).detach();

        std::thread([] {
            while (true)
            {
                features::c_triggerbot::update();
                std::this_thread::sleep_for(std::chrono::milliseconds(globals->performance_mode ? 1 : 5));
            }
            }).detach();

        std::thread([] {
            while (true)
            {
                features::c_player_lock::update();
                std::this_thread::sleep_for(std::chrono::milliseconds(globals->performance_mode ? 1 : 5));
            }
            }).detach();

        // Start wallcheck thread
        std::thread(features::wallcheck::update_thread).detach();
    }
}
