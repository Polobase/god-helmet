#include "journal.h"

#include <Arduino.h>
#include <Preferences.h>
#include <esp_attr.h>
#include <esp_random.h>
#include <esp_system.h>
#include <esp_timer.h>

#include <cstdio>
#include <cstring>

#include "logbook.h"
#include "recover.h"
#include "usblink.h"

namespace journal {
namespace {

// Two copies of the progress record. RTC memory is not initialised at start,
// so plain words are used here (an object with initialisers could be zeroed
// by its constructor) and copied in and out.
RTC_NOINIT_ATTR uint32_t gRtc[2 * sizeof(resume::Progress) / sizeof(uint32_t)];
static_assert(sizeof(gRtc) == 2 * sizeof(resume::Progress), "the record must be a whole number of words");

resume::Progress gWork[2];  // what gRtc holds. After setup(): sequencer task only
resume::Progress gLast;     // the newest record of the run before this start
bool gHaveLast = false;
uint32_t gBootId = 0;
resume::Reset gReset = resume::Reset::Unknown;
char gHelmetId[13] = "";
uint32_t gRecovered = 0;

resume::Reset mapReset(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON: return resume::Reset::PowerOn;
    case ESP_RST_EXT: return resume::Reset::External;
    case ESP_RST_SW: return resume::Reset::Software;
    case ESP_RST_PANIC: return resume::Reset::Panic;
    case ESP_RST_INT_WDT: return resume::Reset::IntWatchdog;
    case ESP_RST_TASK_WDT: return resume::Reset::TaskWatchdog;
    case ESP_RST_WDT: return resume::Reset::Watchdog;
    case ESP_RST_DEEPSLEEP: return resume::Reset::DeepSleep;
    case ESP_RST_BROWNOUT: return resume::Reset::Brownout;
    case ESP_RST_SDIO: return resume::Reset::Sdio;
    case ESP_RST_USB: return resume::Reset::Usb;
    case ESP_RST_JTAG: return resume::Reset::Jtag;
    default: return resume::Reset::Unknown;
  }
}

void writeRtc(int slot) {
  std::memcpy(reinterpret_cast<uint8_t*>(gRtc) + slot * sizeof(resume::Progress), &gWork[slot], sizeof(resume::Progress));
}

}  // namespace

void begin() {
  gReset = mapReset(esp_reset_reason());
  resume::helmetId(ESP.getEfuseMac(), gHelmetId);

  std::memcpy(gWork, gRtc, sizeof gWork);
  const int newest = resume::newest(gWork);
  if (newest >= 0) {
    gLast = gWork[newest];
    gHaveLast = true;
  }

  // Counted in flash, so two starts never share a number (an app compares it
  // to see that the helmet restarted).
  Preferences p;
  if (p.begin("journal", false)) {
    gBootId = p.getUInt("boots", 0) + 1;
    p.putUInt("boots", gBootId);
    p.end();
  }
  if (gBootId == 0) gBootId = esp_random() | 0x40000000u;  // no storage: at least different
}

const char* helmetId() { return gHelmetId; }
uint32_t bootId() { return gBootId; }
resume::Reset reset() { return gReset; }
const char* resetReason() { return resume::resetName(gReset); }
uint32_t uptimeS() { return static_cast<uint32_t>(esp_timer_get_time() / 1000000); }
uint32_t recoveredLogId() { return gRecovered; }

void recover() {
  uint32_t ids[3];
  const size_t n = logbook::unfinished(ids, 3);
  for (size_t i = 0; i < n; ++i) {
    resume::Closure c;
    if (gHaveLast && gLast.logId == ids[i]) c = resume::decide(&gLast, gReset);
    logbook::Closing done;
    done.logId = ids[i];
    char reason[40];
    if (c.close) {
      done.elapsedMs = c.elapsedMs;
      done.completed = c.completed;
      done.finalFieldUT = c.fieldUT;
      done.fieldChanges = c.fieldChanges;
      done.skips = c.skips;
      std::snprintf(reason, sizeof reason, "%s", c.reason);
    } else if (gReset == resume::Reset::PowerOn) {
      std::snprintf(reason, sizeof reason, "power lost");  // nothing survived: how long it ran is not known
    } else {
      std::snprintf(reason, sizeof reason, "restart: %s", resume::resetName(gReset));
    }
    done.reason = reason;
    const bool ok = logbook::close(done);
    if (ok && gRecovered == 0) gRecovered = ids[i];
    usblink::logf("Log entry %lu was open at the restart: %s after %lu s%s\n", static_cast<unsigned long>(ids[i]), reason,
                  static_cast<unsigned long>(done.elapsedMs / 1000), ok ? "" : " (could not be written)");
  }
  // The record has done its work; the next session writes a new one.
  resume::clear(gWork);
  std::memcpy(gRtc, gWork, sizeof gWork);
  gHaveLast = false;
}

void save(const resume::Progress& progress) {
  resume::commit(gWork, progress);
  const int written = resume::newest(gWork);
  if (written >= 0) writeRtc(written);
}

}  // namespace journal
