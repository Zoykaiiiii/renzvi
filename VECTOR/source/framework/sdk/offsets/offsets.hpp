#pragma once
#include <cstdint>

#define CLIENT_VERSION "version-f0ea5da9412f4e35"

// Migrated from user supplied theo offsets, dumped 2026-11-04.
namespace sdk::offsets {
    struct instance {
        static constexpr std::uintptr_t name = 0x68; // Instance.NameContainer
        static constexpr std::uintptr_t class_descriptor = 0x18; // Instance.ClassDescriptor
        static constexpr std::uintptr_t class_name = 0x8; // Instance.ClassName
        static constexpr std::uintptr_t children = 0x70; // Instance.ChildrenStart
        static constexpr std::uintptr_t parent = 0x60; // Instance.Parent
    };
    struct datamodel {
        static constexpr std::uintptr_t pointer = 0x8EB6960; // FakeDataModel.Pointer
        static constexpr std::uintptr_t realdatamodel = 0x1F8; // FakeDataModel.RealDataModel
        static constexpr std::uintptr_t gameid = 0x178; // DataModel.GameId
        static constexpr std::uintptr_t is_loaded = 0x588; // DataModel.GameLoaded
    };
    struct primitives {
        static constexpr std::uintptr_t primitive = 0x178; // BasePart.Primitive
        static constexpr std::uintptr_t rotation = 0xB0; // Primitive.Rotation
        static constexpr std::uintptr_t translation = 0xD4; // Primitive.Position
        static constexpr std::uintptr_t velocity = 0xE0; // Primitive.AssemblyLinearVelocity
        static constexpr std::uintptr_t size = 0x1C4; // Primitive.Size
        static constexpr std::uintptr_t cframe = 0xB0; // Primitive.Rotation
    };
    struct guiobject {
        static constexpr std::uintptr_t position = 0x4D8; // GuiObject.Position
    };
    struct lighting {
        static constexpr std::uintptr_t ambient = 0xB8; // Lighting.Ambient
        static constexpr std::uintptr_t brightness = 0x100; // Lighting.Brightness
        static constexpr std::uintptr_t color_shift_bottom = 0xD0; // Lighting.ColorShift_Bottom
        static constexpr std::uintptr_t color_shift_top = 0xC4; // Lighting.ColorShift_Top
        static constexpr std::uintptr_t fog_color = 0xDC; // Lighting.FogColor
        static constexpr std::uintptr_t fog_end = 0x114; // Lighting.FogEnd
        static constexpr std::uintptr_t fog_start = 0x118; // Lighting.FogStart
        static constexpr std::uintptr_t outdoor_ambient = 0xE8; // Lighting.OutdoorAmbient
    };
    struct camera {
        static constexpr std::uintptr_t rotation = 0xC0; // Camera.Rotation
        static constexpr std::uintptr_t translation = 0xE4; // Camera.Position
        static constexpr std::uintptr_t field_of_view = 0x128; // Camera.FieldOfView
    };
    struct workspace {
        static constexpr std::uintptr_t camera = 0x4A0; // Workspace.CurrentCamera
    };
    struct players {
        static constexpr std::uintptr_t local_player = 0x118; // Player.LocalPlayer
    };
    struct player {
        static constexpr std::uintptr_t display = 0x120; // Player.DisplayName
        static constexpr std::uintptr_t team = 0x2E0; // Player.Team
        static constexpr std::uintptr_t user_id = 0xB8; // Player.UserId
        static constexpr std::uintptr_t character = 0x2A0; // Player.ModelInstance
        static constexpr std::uintptr_t animation_id = 0xA8; // Misc.AnimationId
    };
    struct humanoid {
        static constexpr std::uintptr_t camera_offset = 0x110; // Humanoid.CameraOffset
        static constexpr std::uintptr_t health = 0x184; // Humanoid.Health
        static constexpr std::uintptr_t max_health = 0x19C; // Humanoid.MaxHealth
        static constexpr std::uintptr_t hip_height = 0x188; // Humanoid.HipHeight
        static constexpr std::uintptr_t jump_power = 0x198; // Humanoid.JumpPower
        static constexpr std::uintptr_t walk_speed = 0x1C4; // Humanoid.Walkspeed
        static constexpr std::uintptr_t walk_speed_check = 0x39C; // Humanoid.WalkspeedCheck
        static constexpr std::uintptr_t move_direction = 0x134; // Humanoid.MoveDirection
        static constexpr std::uintptr_t auto_rotate = 0x1C9; // Humanoid.AutoRotate
    };
    struct visualengine {
        static constexpr std::uintptr_t pointer = 0x8942E38; // VisualEngine.Pointer
        static constexpr std::uintptr_t view_matrix = 0x1B0; // VisualEngine.ViewMatrix
        static constexpr std::uintptr_t view_port = 0xB10; // VisualEngine.Dimensions
    };
    struct mouseservice {
        static constexpr std::uintptr_t input_object = 0xE8; // MouseService.InputObject
        static constexpr std::uintptr_t mouse_position_x = 0xBC; // MouseService.MousePosition
        static constexpr std::uintptr_t mouse_position_y = 0xC0; // MouseService.MousePosition + sizeof(float)
    };
    struct basepart {
        static constexpr std::uintptr_t transparency = 0x118; // BasePart.Transparency
    };
}
