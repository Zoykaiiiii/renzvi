#pragma once

#include <windows.h>
#include <tlhelp32.h>
#include <algorithm>
#include <cstdint>
#include <limits>
#include <memory>
#include <string>
#include <type_traits>
#include <vector>

// Ordinary Windows process access. No executable buffers, syscall stubs or
// dynamic NT API resolution are used by this wrapper.
class c_memory
{
public:
    inline static constexpr const char* supported_client_version = "version-f0ea5da9412f4e35";

    c_memory() = default;
    ~c_memory() { close_process(); }
    c_memory(const c_memory&) = delete;
    c_memory& operator=(const c_memory&) = delete;
    c_memory(c_memory&&) = delete;
    c_memory& operator=(c_memory&&) = delete;

    static std::unique_ptr<c_memory>& instance()
    {
        static std::unique_ptr<c_memory> singleton = std::make_unique<c_memory>();
        return singleton;
    }

    DWORD get_process_id(const std::string& process_name)
    {
        scoped_handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0));
        if (!snapshot.valid())
            return 0;

        PROCESSENTRY32 entry{};
        entry.dwSize = sizeof(entry);
        if (Process32First(snapshot.get(), &entry))
        {
            do
            {
                if (_stricmp(entry.szExeFile, process_name.c_str()) == 0)
                {
                    if (m_process_id != entry.th32ProcessID)
                        close_process();
                    m_process_id = entry.th32ProcessID;
                    return m_process_id;
                }
            } while (Process32Next(snapshot.get(), &entry));
        }

        close_process();
        SetLastError(ERROR_NOT_FOUND);
        return 0;
    }

    HANDLE get_process_handle(const std::string& process_name)
    {
        if (!get_process_id(process_name))
            return nullptr;
        if (m_process_handle)
            return m_process_handle;

        constexpr DWORD access = PROCESS_VM_READ | PROCESS_VM_WRITE |
            PROCESS_VM_OPERATION | PROCESS_QUERY_LIMITED_INFORMATION;
        m_process_handle = OpenProcess(access, FALSE, m_process_id);
        return m_process_handle;
    }

    uintptr_t get_process_base(const std::string& process_name)
    {
        m_process_base = 0;
        if (!m_process_id || !m_process_handle)
            return 0;

        // A folder match is a compatibility check, not binary authentication.
        // Do not use this offset profile when its client version differs.
        if (_stricmp(process_name.c_str(), "RobloxPlayerBeta.exe") == 0 &&
            !matches_client_version())
        {
            SetLastError(ERROR_REVISION_MISMATCH);
            return 0;
        }

        m_process_base = get_module_base(process_name);
        return m_process_base;
    }

    uintptr_t get_module_base(const std::string& module_name)
    {
        if (!m_process_id)
            return 0;

        scoped_handle snapshot(CreateToolhelp32Snapshot(
            TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, m_process_id));
        if (!snapshot.valid())
            return 0;

        MODULEENTRY32 entry{};
        entry.dwSize = sizeof(entry);
        if (Module32First(snapshot.get(), &entry))
        {
            do
            {
                if (_stricmp(entry.szModule, module_name.c_str()) == 0)
                    return reinterpret_cast<uintptr_t>(entry.modBaseAddr);
            } while (Module32Next(snapshot.get(), &entry));
        }
        SetLastError(ERROR_MOD_NOT_FOUND);
        return 0;
    }

    uintptr_t find_region(SIZE_T region_size) const
    {
        if (!m_process_handle || !region_size)
            return 0;
        SYSTEM_INFO info{};
        GetSystemInfo(&info);
        uintptr_t current = reinterpret_cast<uintptr_t>(info.lpMinimumApplicationAddress);
        const uintptr_t end = reinterpret_cast<uintptr_t>(info.lpMaximumApplicationAddress);
        while (current < end)
        {
            MEMORY_BASIC_INFORMATION region{};
            // VirtualQueryEx may require additional query rights on some systems;
            // failure simply ends the optional search, without elevating access.
            if (VirtualQueryEx(m_process_handle, reinterpret_cast<LPCVOID>(current),
                    &region, sizeof(region)) != sizeof(region))
                break;
            if (region.Type == MEM_PRIVATE && region.State == MEM_COMMIT &&
                region.Protect == PAGE_READWRITE && region.RegionSize == region_size)
                return reinterpret_cast<uintptr_t>(region.BaseAddress);
            const uintptr_t base = reinterpret_cast<uintptr_t>(region.BaseAddress);
            if (!valid_range(base, region.RegionSize))
                break;
            const uintptr_t next = base + region.RegionSize;
            if (next <= current)
                break;
            current = next;
        }
        return 0;
    }

    bool read_bytes(uintptr_t address, void* buffer, size_t size) const noexcept
    {
        return read_exact(m_process_handle, address, buffer, size);
    }

    template <typename T>
    T read(uintptr_t address) const noexcept
    {
        static_assert(std::is_trivially_copyable_v<T>, "process reads require a plain value type");
        T value{};
        if (!read_bytes(address, &value, sizeof(value)))
            return T{};
        return value;
    }

    template <typename T>
    void write(uintptr_t address, const T& value) const noexcept
    {
        static_assert(std::is_trivially_copyable_v<T>, "process writes require a plain value type");
        write_bytes(address, &value, sizeof(value));
    }

    template <typename T>
    void write_array(uintptr_t address, const T* buffer, size_t count) const noexcept
    {
        static_assert(std::is_trivially_copyable_v<T>, "process writes require a plain value type");
        if (count > (std::numeric_limits<size_t>::max)() / sizeof(T))
            return;
        write_bytes(address, buffer, count * sizeof(T));
    }

    bool write_bytes(uint64_t address, const void* buffer, size_t size) const noexcept
    {
        return write_exact(m_process_handle, static_cast<uintptr_t>(address), buffer, size);
    }

    // Compatibility names retained for existing callers; all use documented
    // ReadProcessMemory/WriteProcessMemory, with exact byte-count checks.
    template <typename T> T syscall_read(uint64_t address) const noexcept
    {
        return read<T>(static_cast<uintptr_t>(address));
    }
    template <typename T> bool syscall_write(uint64_t address, const T& value) const noexcept
    {
        static_assert(std::is_trivially_copyable_v<T>, "process writes require a plain value type");
        return write_bytes(address, &value, sizeof(value));
    }
    template <typename T> T zw_read(uint64_t address) const noexcept
    {
        return read<T>(static_cast<uintptr_t>(address));
    }
    template <typename T> bool zw_write(uint64_t address, const T& value) const noexcept
    {
        return syscall_write(address, value);
    }

    std::string read_string(uintptr_t address) const
    {
        return read_string_object(address, 256);
    }

    // Existing SDK callers pass the address of an MSVC string object here,
    // despite the historical method name, rather than a raw char pointer.
    std::string read_cstring(uintptr_t address, size_t max_length = 256) const
    {
        return read_string_object(address, max_length);
    }

    bool writestring(HANDLE process_handle, uintptr_t base_address,
        uintptr_t string_offset, const std::string& value) const
    {
        if (!process_handle || !valid_range(base_address, string_offset) ||
            value.size() > max_string_length)
            return false;
        const uintptr_t object = base_address + string_offset;
        if (!valid_range(object, 0x20))
            return false;

        size_t length{}, capacity{};
        if (!read_exact(process_handle, object + 0x10, &length, sizeof(length)) ||
            !read_exact(process_handle, object + 0x18, &capacity, sizeof(capacity)) ||
            length > capacity || capacity > max_string_length || value.size() > capacity)
            return false;

        uintptr_t data = object;
        if (capacity >= 16 &&
            !read_exact(process_handle, object, &data, sizeof(data)))
            return false;
        if (capacity < 16 && value.size() >= 16)
            return false;

        // Stay within the allocation already owned by the remote string. No
        // remote allocation or change to its capacity/ownership is attempted.
        if (!write_exact(process_handle, data, value.c_str(), value.size() + 1))
            return false;
        const size_t new_length = value.size();
        return write_exact(process_handle, object + 0x10, &new_length, sizeof(new_length));
    }

    HANDLE get_handle() const noexcept { return m_process_handle; }

private:
    class scoped_handle
    {
    public:
        explicit scoped_handle(HANDLE handle) noexcept : handle_(handle) {}
        ~scoped_handle() { if (valid()) CloseHandle(handle_); }
        scoped_handle(const scoped_handle&) = delete;
        scoped_handle& operator=(const scoped_handle&) = delete;
        bool valid() const noexcept { return handle_ && handle_ != INVALID_HANDLE_VALUE; }
        HANDLE get() const noexcept { return handle_; }
    private:
        HANDLE handle_;
    };

    inline static constexpr size_t max_string_length = 4096;
    DWORD m_process_id{0};
    HANDLE m_process_handle{nullptr};
    uintptr_t m_process_base{0};

    void close_process() noexcept
    {
        if (m_process_handle && m_process_handle != INVALID_HANDLE_VALUE)
            CloseHandle(m_process_handle);
        m_process_handle = nullptr;
        m_process_id = 0;
        m_process_base = 0;
    }

    static bool valid_range(uintptr_t address, size_t size) noexcept
    {
        return address >= 0x10000 && size <= (std::numeric_limits<uintptr_t>::max)() - address;
    }

    static bool read_exact(HANDLE process, uintptr_t address, void* buffer, size_t size) noexcept
    {
        if (!process || process == INVALID_HANDLE_VALUE || !buffer || !valid_range(address, size))
            return false;
        if (!size)
            return true;
        SIZE_T bytes_read{};
        return ReadProcessMemory(process, reinterpret_cast<LPCVOID>(address), buffer, size,
            &bytes_read) && bytes_read == size;
    }

    static bool write_exact(HANDLE process, uintptr_t address, const void* buffer, size_t size) noexcept
    {
        if (!process || process == INVALID_HANDLE_VALUE || !buffer || !valid_range(address, size))
            return false;
        if (!size)
            return true;
        SIZE_T bytes_written{};
        return WriteProcessMemory(process, reinterpret_cast<LPVOID>(address), buffer, size,
            &bytes_written) && bytes_written == size;
    }

    bool matches_client_version() const
    {
        std::vector<char> path(32768, '\0');
        DWORD length = static_cast<DWORD>(path.size());
        if (!QueryFullProcessImageNameA(m_process_handle, 0, path.data(), &length) || !length)
            return false;
        const std::string full_path(path.data(), length);
        const size_t last_separator = full_path.find_last_of("\\/");
        if (last_separator == std::string::npos || !last_separator)
            return false;
        const std::string parent = full_path.substr(0, last_separator);
        const size_t previous_separator = parent.find_last_of("\\/");
        const std::string folder = parent.substr(previous_separator == std::string::npos ? 0 : previous_separator + 1);
        return _stricmp(folder.c_str(), supported_client_version) == 0;
    }

    std::string read_string_object(uintptr_t object, size_t max_length) const
    {
        if (!max_length || !valid_range(object, 0x20))
            return "NULL";
        size_t length{}, capacity{};
        if (!read_bytes(object + 0x10, &length, sizeof(length)) ||
            !read_bytes(object + 0x18, &capacity, sizeof(capacity)) ||
            length > (std::min)(max_length, max_string_length) ||
            length > capacity || capacity > max_string_length)
            return "NULL";
        if (!length)
            return {};

        uintptr_t data = object;
        if (capacity >= 16 && !read_bytes(object, &data, sizeof(data)))
            return "NULL";
        std::string result(length, '\0');
        return read_bytes(data, result.data(), length) ? result : "NULL";
    }
};

inline std::unique_ptr<c_memory>& g_memory = c_memory::instance();
