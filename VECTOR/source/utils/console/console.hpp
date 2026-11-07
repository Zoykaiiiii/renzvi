#pragma once
#include <windows.h>
#include <memory>
#include <string>

class c_console
{
public:
	enum class log_level
	{
		debug,
		info,
		warning,
		error,
		critical,
		welcome
	};
public:
	c_console()
	{
		this->m_handle = GetStdHandle(STD_OUTPUT_HANDLE);
		this->m_hwnd = GetConsoleWindow();
	}

	void initialize()
	{
		enable_ansi();
		set_font(L"Terminal");
		resize_window(500, 300);
	}

	void set_title(std::string_view name)
	{
		SetConsoleTitleA(name.data());
	}

	void set_font(std::wstring_view name)
	{
		CONSOLE_FONT_INFOEX font_info = { sizeof(CONSOLE_FONT_INFOEX) };
		font_info.FontFamily = FF_DONTCARE;
		font_info.FontWeight = FW_NORMAL;
		wcscpy_s(font_info.FaceName, name.data());
		SetCurrentConsoleFontEx(m_handle, FALSE, &font_info);
	}

	void resize_window(int width, int height)
	{
		RECT rect;
		GetWindowRect(m_hwnd, &rect);
		MoveWindow(m_hwnd, rect.left, rect.top, width, height, TRUE);
	}

	void print(const log_level level, const char* format, ...) const
	{
		const auto level_string = this->level_to_string(level);
		const auto color = this->color_for_level(level);

		std::printf("%s[%s%s%s]: ", color_white, color, level_string, color_white);

		va_list args;
		va_start(args, format);
		std::vprintf(format, args);
		va_end(args);

		std::printf("%s\n", color_reset);
	}
private:
	inline void enable_ansi() const
	{
		HANDLE handle = GetStdHandle(STD_OUTPUT_HANDLE);
		DWORD mode = 0;
		if (GetConsoleMode(handle, &mode))
		{
			mode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
			SetConsoleMode(handle, mode);
		}
	}

	[[nodiscard]] inline const char* level_to_string(const log_level level) const
	{
		switch (level)
		{
		case log_level::debug:	    return "DEBUG";
		case log_level::info:	    return "INFO";
		case log_level::warning:	return "WARNING";
		case log_level::error:	    return "ERROR";
		case log_level::critical:	return "CRITICAL";
		case log_level::welcome:	return "WELCOME";
		default:					return "UNKNOWN";
		}
	}

	[[nodiscard]] inline const char* color_for_level(const log_level level) const
	{
		switch (level)
		{
		case log_level::debug:	    return color_light_blue;
		case log_level::info:	    return color_green;
		case log_level::warning:	return color_yellow;
		case log_level::error:
		case log_level::critical:	return color_red;
		case log_level::welcome:	return color_purple;
		default:					return color_purple;
		}
	}
private:
	HANDLE m_handle{ nullptr };
	HWND m_hwnd{ nullptr };

	static constexpr const char* color_blue = "\033[0;34m";
	static constexpr const char* color_light_blue = "\033[1;34m";
	static constexpr const char* color_green = "\033[0;32m";
	static constexpr const char* color_yellow = "\033[0;33m";
	static constexpr const char* color_red = "\033[0;31m";
	static constexpr const char* color_white = "\033[0;37m";
	static constexpr const char* color_purple = "\033[0;35m";
	static constexpr const char* color_reset = "\033[0m";
}; inline std::unique_ptr<c_console> console = std::make_unique<c_console>();