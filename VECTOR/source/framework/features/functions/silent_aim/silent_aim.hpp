#pragma once

#include <memory>
#include <source/framework/sdk/classes/c_instance.hpp>
#include <source/framework/sdk/classes/c_primitives.hpp>
#include <source/framework/globals/globals.hpp>
namespace features
{
    class c_silent_aim
    {
    private:
        std::unique_ptr<entity> current_target = nullptr;

        std::string get_target_part_name();
        sdk::vector3_t get_target_position();
        std::unique_ptr<entity> find_closest_target();
        bool has_valid_target();
        void apply_silent_aim(const sdk::vector3_t& target_pos);
        void update();

    public:
        void initialize();
    };

    inline std::unique_ptr<c_silent_aim> silent_aim = std::make_unique<c_silent_aim>();
}