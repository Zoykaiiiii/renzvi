#ifndef RUNSERVICE_H
#define RUNSERVICE_H

#include <functional>
#include <chrono>
#include <thread>
#include <vector>
#include <mutex>

namespace sdk
{
    class c_runservice
    {
    public:
        using callback_t = std::function<void(double)>;

        inline static c_runservice* instance()
        {
            static c_runservice _instance;
            return &_instance;
        }

        inline void connect_heartbeat(callback_t cb)
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            m_callbacks.push_back(cb);
        }

        inline void start(double targetFPS = 144.0)
        {
            if (m_running) return;
            m_running = true;
            std::thread([this, targetFPS]() {
                auto frameDuration = std::chrono::duration<double>(1.0 / targetFPS);
                auto lastTime = std::chrono::steady_clock::now();

                while (m_running)
                {
                    auto now = std::chrono::steady_clock::now();
                    std::chrono::duration<double> deltaTime = now - lastTime;
                    lastTime = now;

                    {
                        std::lock_guard<std::mutex> lock(m_mutex);
                        for (auto& cb : m_callbacks)
                        {
                            try
                            {
                                cb(deltaTime.count()); // execute each callback quickly
                            }
                            catch (...)
                            {
                                // safely ignore errors so one callback doesn't stop others
                            }
                        }
                    }

                    auto nextFrame = lastTime + frameDuration;
                    std::this_thread::sleep_until(nextFrame);
                }
                }).detach();
        }

        inline void stop() { m_running = false; }

    private:
        c_runservice() : m_running(false) {}

        std::vector<callback_t> m_callbacks;
        std::mutex m_mutex;
        bool m_running;
    };
}

#endif
