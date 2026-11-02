// Sets an output pin straight in the GPIO registers: a few cycles, safe in an
// interrupt (always inlined, no flash access), on every ESP32 chip. Pin -1
// (not fitted on this board) compiles to nothing.
#pragma once
#include <soc/gpio_reg.h>
#include <soc/soc.h>
#include <soc/soc_caps.h>

template <int Pin>
__attribute__((always_inline)) inline void fastWrite(bool high) {
  if constexpr (Pin >= 32) {
#if SOC_GPIO_PIN_COUNT > 32
    REG_WRITE(high ? GPIO_OUT1_W1TS_REG : GPIO_OUT1_W1TC_REG, 1u << (Pin - 32));
#endif
  } else if constexpr (Pin >= 0) {
    REG_WRITE(high ? GPIO_OUT_W1TS_REG : GPIO_OUT_W1TC_REG, 1u << Pin);
  }
}
