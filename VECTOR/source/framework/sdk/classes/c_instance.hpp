#pragma once

#include <iostream>

#include "../../../utils/memory/memory.hpp"
#include "../offsets/offsets.hpp"
#include "../math/cframe_t.hpp"
#include "../math/matrix_t.hpp"
#include "../math/matrix3_t.hpp"
#include "../math/matrix4_t.hpp"
#include "../math/vector2_t.hpp"
#include "../math/vector3_t.hpp"
#include "../math/vector4_t.hpp"

namespace sdk
{
    class c_instance : public std::enable_shared_from_this<c_instance>
    {
    public:
        explicit c_instance(std::uint64_t address) : address(address) {}
        
        std::uint64_t address;

        inline std::string get_name() const
        {
            std::uint64_t name = g_memory->read<::uint64_t>(this->address + offsets::instance::name);
            return name ? g_memory->read_string(name) : "NULL";
        }

        inline std::string get_class_name() const
        {
            std::uint64_t class_descriptor = g_memory->read<std::uint64_t>(this->address + offsets::instance::class_descriptor);
            std::uint64_t class_name_addr = class_descriptor + offsets::instance::class_name;
            std::uint64_t class_name_ptr = g_memory->read<std::uint64_t>(class_name_addr);

            if (!class_name_ptr) return "NULL";

            std::string result = g_memory->read_cstring(class_name_ptr);
           // printf("returned: '%s' (length: %zu)\n", result.c_str(), result.length());

            return result;
        }
        inline std::shared_ptr<c_instance> get_parent() const
        {
            std::uint64_t parent_pointer = g_memory->read<std::uint64_t>(this->address + offsets::instance::parent);
            return parent_pointer ? std::make_shared<c_instance>(parent_pointer) : nullptr;
        }

        inline std::vector<std::shared_ptr<c_instance>> get_children() const
        {
            std::vector<std::shared_ptr<c_instance>> children;

            if (this->address == 0)
                return children;

            std::uint64_t children_container = g_memory->read<std::uint64_t>(this->address + offsets::instance::children);

            if (children_container)
            {
                std::uint64_t top = g_memory->read<std::uint64_t>(children_container);
                std::uint64_t end = g_memory->read<std::uint64_t>(children_container + 0x8);

                // Reject malformed spans instead of looping over arbitrary memory.
                if (top < 0x10000 || end < top || (end - top) % 16 ||
                    (end - top) / 16 > 16384)
                    return children;

                children.reserve(static_cast<size_t>((end - top) / 16));
                while (top < end)
                {
                    std::uint64_t child_pointer = g_memory->read<std::uint64_t>(top);
                    if (child_pointer >= 0x10000)
                        children.push_back(std::make_shared<c_instance>(child_pointer));
                    top += 16;
                }
            }

            return children;
        }


        inline std::shared_ptr<c_instance> find_first_child(const std::string& name) const
        {
            for (auto& child : get_children())
            {
                if (child->get_name() == name)
                    return child;
            }
            return nullptr;
        }

        inline std::shared_ptr<c_instance> find_first_child_of_class(const std::string& name) const
        {
            for (auto& child : get_children())
            {
                if (child->get_class_name() == name)
                    return child;
            }
            return nullptr;
        }

        inline bool is_a(const std::string& name) const
        {
            return this->get_class_name() == name;
        }
    };
}
