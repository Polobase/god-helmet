# LovyanGFX 1.1.16's HUB75 driver (Bus_HUB75.cpp) uses ESP_EARLY_LOGE, which
# Arduino-ESP32 3.0.3 maps to ets_printf without including its header.
# C++ only: the header breaks LovyanGFX's C sources (lgfx_qrcode.c).
Import("env")
env.Append(CXXFLAGS=["-include", "rom/ets_sys.h"])
