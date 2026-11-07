#pragma once
#ifndef _USE_MATH_DEFINES
#define _USE_MATH_DEFINES
#endif 
#include <vector>
#include <string>
#include <memory>
#include <cstdint>
#include <cmath> 

#include "classes/c_instance.hpp"
#include "classes/c_datamodel.hpp"
#include "classes/c_camera.hpp"
#include "classes/c_workspace.hpp"
#include "classes/c_primitives.hpp"
#include "classes/c_player.hpp"
#include "classes/c_players.hpp"
#include "classes/c_renderview.hpp"
#include "classes/c_visual_engine.hpp"
#include "classes/c_humanoid.hpp"
#include "classes/c_mouse_service.hpp"
#include "classes/c_gui_object.hpp"
#include <source/framework/features/cache/runservice/runservice.hpp>
#include <source/framework/overlay/misc/widgets.h>
#include <source/framework/features/cache/cache.hpp>
#include <source/framework/features/cache/wallcheck/wallcheck.hpp>
#include <source/framework/overlay/menu.hpp>
#include <source/utils/imgui/imgui.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

//inline std::unique_ptr<sdk::c_datamodel> datamodel = nullptr;

// classes header files should only have 1 include wich is #include <source/framework/sdk/includes.hpp>
// make sure not to include a file in the same thing for exampole in workspace do #include "workspace.hpp"