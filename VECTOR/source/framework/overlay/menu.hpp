#pragma once

#include <memory>



namespace overlay
{
	class c_menu
	{
	public:
		int load();
	}; inline std::unique_ptr<c_menu> menu = std::make_unique<c_menu>();
}
