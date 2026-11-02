// Drawing and touch primitives for the 240x320 portrait touchscreen UI.
// Everything runs in the Arduino loop task (as do the BLE requests), so none
// of this needs locking.
#pragma once
#include <Arduino.h>

#include <string>
#include <vector>

#include "display.h"

namespace ui {

namespace color {
constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return static_cast<uint16_t>(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}
// Dark theme: the helmet is used in a dark room.
constexpr uint16_t kBg = rgb(0, 0, 0);
constexpr uint16_t kHeader = rgb(22, 26, 32);
constexpr uint16_t kPanel = rgb(34, 39, 47);
constexpr uint16_t kPanelHi = rgb(74, 82, 96);
constexpr uint16_t kLine = rgb(56, 62, 72);
constexpr uint16_t kText = rgb(236, 236, 236);
constexpr uint16_t kMuted = rgb(150, 156, 166);
constexpr uint16_t kAccent = rgb(28, 132, 124);
constexpr uint16_t kAccentHi = rgb(56, 180, 168);
constexpr uint16_t kWarn = rgb(230, 166, 50);
constexpr uint16_t kWarnDark = rgb(110, 76, 14);
constexpr uint16_t kBad = rgb(190, 34, 34);
constexpr uint16_t kBadHi = rgb(240, 84, 84);
constexpr uint16_t kGood = rgb(90, 190, 100);
}  // namespace color

constexpr int kW = 240;
constexpr int kH = 320;
constexpr int kHeaderH = 30;
constexpr int kTop = kHeaderH + 6;  // first content line
constexpr int kFooterY = 272;       // footer button row (to 316)
constexpr int kFooterH = 44;
constexpr int kMargin = 8;

enum class Style : uint8_t { Normal, Primary, Danger, Warn, Ghost, Selected, Row };
enum class Icon : uint8_t { None, Back, Up, Down, Left, Right, Minus, Plus };

enum ButtonFlags : uint8_t {
  kOnPress = 1,  // fires on touch-down (STOP), not on release
  kRepeat = 2,   // fires again while held (+/- buttons)
  kNoDraw = 4,   // invisible touch area (the coil map)
};

// Button ids shared by all screens.
enum : uint8_t { kIdBack = 250, kIdPrev = 251, kIdNext = 252, kIdNone = 255 };

struct Button {
  int16_t x = 0, y = 0, w = 0, h = 0;
  uint8_t id = kIdNone;
  uint8_t flags = 0;
  Style style = Style::Normal;
  Icon icon = Icon::None;
  char label[96] = {0};  // Row of 56 px or more: wrapped to two lines
  char sub[64] = {0};    // Row: last line (or right-aligned value on short rows)
};

// Fonts (all 7-bit ASCII).
void fontSmall();  // DejaVu 12 px: notes, long text
void fontBody();   // FreeSans 9 pt: lists, buttons
void fontBold();   // FreeSans bold 9 pt: titles
void fontBig();    // DejaVu 40 px: session timer
int lineHeight();  // of the current font

// UTF-8 to plain ASCII (typographic dashes, arrows, middle dots, micro sign).
std::string fold(const std::string& utf8);
// Fits text into `width` px with the current font, cutting with "..." if needed.
String fit(const String& text, int width);
// Word wrap with the current font; '\n' forces a break.
std::vector<std::string> wrap(const std::string& text, int width);
// Draws wrapped text; returns the y below the last line drawn. Stops at maxY,
// ending the last line with "..." when text is left over.
int drawWrapped(const std::string& text, int x, int y, int width, uint16_t fg, int maxY);
void text(const String& s, int x, int y, uint16_t fg, textdatum_t datum = textdatum_t::top_left);

// Screen frame.
void clear();  // black screen, no buttons
uint32_t lastClearMs();  // when the screen was last cleared (new screen or full redraw)
void header(const String& title, bool back);
void headerClock();  // redraws the clock corner of the header

// Buttons of the current screen. Adding an id that exists replaces that button.
void clearButtons();
Button& addButton(int x, int y, int w, int h, uint8_t id, const char* label, Style style = Style::Normal,
                  uint8_t flags = 0, Icon icon = Icon::None);
Button* button(uint8_t id);
void drawButton(const Button& b, bool pressed = false);
void setButton(uint8_t id, const char* label, Style style);
// Footer with page arrows and "n/m"; ids kIdPrev / kIdNext.
void pager(int page, int pages, int y = kFooterY);

struct TouchEvent {
  enum Type : uint8_t { None, Down, Hold, Up } type = None;
  int16_t x = 0, y = 0;
};
// Polls the touch controller (at most every 8 ms, debounced).
TouchEvent pollTouch();
uint32_t lastTouchMs();
// Runs the button logic for one touch event: highlight on press, fire on
// release inside the button (kOnPress: on press; kRepeat: also while held).
// Returns the id to act on, or kIdNone. `x`, `y` get the touch position.
uint8_t handleTouch(const TouchEvent& e, int16_t& x, int16_t& y);
// Forgets the button being pressed (call when the screen changes mid-touch).
void cancelPress();

}  // namespace ui
