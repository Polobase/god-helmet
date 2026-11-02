#include "widgets.h"

#include <ctime>

#include "../envdata.h"

namespace ui {
namespace {

constexpr int kMaxButtons = 24;
Button gButtons[kMaxButtons];
int gCount = 0;
bool gHeader = false;

int gPressed = -1;
bool gRepeated = false;
uint32_t gPressMs = 0, gRepeatMs = 0;

// Touch debounce state.
uint32_t gLastPoll = 0, gLastTouch = 0;
bool gDown = false;
uint8_t gDownCount = 0, gUpCount = 0;
int16_t gX = 0, gY = 0;

Lcd& lcd() { return display::lcd(); }

bool inside(const Button& b, int x, int y, int slop) {
  return x >= b.x - slop && x < b.x + b.w + slop && y >= b.y - slop && y < b.y + b.h + slop;
}

int hit(int x, int y) {
  for (int i = gCount - 1; i >= 0; --i)
    if (inside(gButtons[i], x, y, 0)) return i;
  for (int i = gCount - 1; i >= 0; --i)
    if (inside(gButtons[i], x, y, 4)) return i;
  return -1;
}

void drawIcon(Icon icon, int cx, int cy, uint16_t fg) {
  auto& d = lcd();
  switch (icon) {
    case Icon::Back:
    case Icon::Left: d.fillTriangle(cx + 5, cy - 8, cx + 5, cy + 8, cx - 6, cy, fg); break;
    case Icon::Right: d.fillTriangle(cx - 5, cy - 8, cx - 5, cy + 8, cx + 6, cy, fg); break;
    case Icon::Up: d.fillTriangle(cx - 9, cy + 5, cx + 9, cy + 5, cx, cy - 6, fg); break;
    case Icon::Down: d.fillTriangle(cx - 9, cy - 5, cx + 9, cy - 5, cx, cy + 6, fg); break;
    case Icon::Minus: d.fillRect(cx - 8, cy - 2, 16, 4, fg); break;
    case Icon::Plus:
      d.fillRect(cx - 8, cy - 2, 16, 4, fg);
      d.fillRect(cx - 2, cy - 8, 4, 16, fg);
      break;
    case Icon::None: break;
  }
}

// UTF-8 code point at s[i]; advances i.
uint32_t decode(const std::string& s, size_t& i) {
  const uint8_t c = static_cast<uint8_t>(s[i++]);
  if (c < 0x80) return c;
  int extra = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : c >= 0xC0 ? 1 : 0;
  uint32_t cp = c & (0x3F >> extra);
  while (extra-- > 0 && i < s.size() && (static_cast<uint8_t>(s[i]) & 0xC0) == 0x80)
    cp = (cp << 6) | (static_cast<uint8_t>(s[i++]) & 0x3F);
  return cp;
}

}  // namespace

void fontSmall() { lcd().setFont(&fonts::DejaVu12); }
void fontBody() { lcd().setFont(&fonts::FreeSans9pt7b); }
void fontBold() { lcd().setFont(&fonts::FreeSansBold9pt7b); }
void fontBig() { lcd().setFont(&fonts::DejaVu40); }
int lineHeight() { return lcd().fontHeight() + 2; }

std::string fold(const std::string& s) {
  std::string out;
  out.reserve(s.size());
  size_t i = 0;
  while (i < s.size()) {
    const uint32_t cp = decode(s, i);
    if (cp < 0x80) {
      out += static_cast<char>(cp);
      continue;
    }
    switch (cp) {
      case 0x2013: case 0x2014: case 0x2212: case 0x00B7: case 0x2022: out += '-'; break;
      case 0x2192: out += "->"; break;
      case 0x2190: out += "<-"; break;
      case 0x2194: out += "<->"; break;
      case 0x2018: case 0x2019: case 0x2032: out += '\''; break;
      case 0x201C: case 0x201D: case 0x2033: out += '"'; break;
      case 0x00B5: case 0x03BC: out += 'u'; break;
      case 0x00D7: out += 'x'; break;
      case 0x2248: out += '~'; break;
      case 0x2264: out += "<="; break;
      case 0x2265: out += ">="; break;
      case 0x00B1: out += "+/-"; break;
      case 0x00B0: out += " deg"; break;
      case 0x2026: out += "..."; break;
      case 0x00A0: case 0x2009: case 0x202F: out += ' '; break;
      default: out += '?'; break;
    }
  }
  return out;
}

String fit(const String& s, int width) {
  if (lcd().textWidth(s.c_str()) <= width) return s;
  int len = s.length();
  while (len > 0) {
    String cut = s.substring(0, len);
    cut.trim();
    cut += "...";
    if (lcd().textWidth(cut.c_str()) <= width) return cut;
    --len;
  }
  return "";
}

std::vector<std::string> wrap(const std::string& text, int width) {
  std::vector<std::string> lines;
  size_t start = 0;
  while (start <= text.size()) {
    size_t end = text.find('\n', start);
    if (end == std::string::npos) end = text.size();
    const std::string para = text.substr(start, end - start);
    if (para.find_first_not_of(' ') == std::string::npos) {
      lines.emplace_back();
    } else {
      size_t p = 0;
      while (p < para.size()) {
        while (p < para.size() && para[p] == ' ') ++p;
        if (p >= para.size()) break;
        size_t fitEnd = p;
        size_t q = p;
        while (q <= para.size()) {
          size_t sp = para.find(' ', q);
          if (sp == std::string::npos) sp = para.size();
          if (lcd().textWidth(para.substr(p, sp - p).c_str()) > width) break;
          fitEnd = sp;
          q = sp + 1;
        }
        if (fitEnd == p) {  // one word wider than the line: cut it
          fitEnd = p + 1;
          while (fitEnd < para.size() && lcd().textWidth(para.substr(p, fitEnd + 1 - p).c_str()) <= width) ++fitEnd;
        }
        lines.push_back(para.substr(p, fitEnd - p));
        p = fitEnd;
      }
    }
    if (end >= text.size()) break;
    start = end + 1;
  }
  while (!lines.empty() && lines.back().empty()) lines.pop_back();
  return lines;
}

// `line` shortened so that "line..." fits into width.
std::string withEllipsis(std::string line, int width) {
  while (!line.empty() && lcd().textWidth((line + "...").c_str()) > width) line.pop_back();
  while (!line.empty() && line.back() == ' ') line.pop_back();
  return line + "...";
}

int drawWrapped(const std::string& s, int x, int y, int width, uint16_t fg, int maxY) {
  const int lh = lineHeight();
  lcd().setTextDatum(textdatum_t::top_left);
  lcd().setTextColor(fg);
  const std::vector<std::string> lines = wrap(s, width);
  for (size_t i = 0; i < lines.size(); ++i) {
    if (y + lh > maxY) break;
    const bool more = i + 1 < lines.size() && y + 2 * lh > maxY;
    lcd().drawString((more ? withEllipsis(lines[i], width) : lines[i]).c_str(), x, y);
    y += lh;
  }
  return y;
}

void text(const String& s, int x, int y, uint16_t fg, textdatum_t datum) {
  lcd().setTextDatum(datum);
  lcd().setTextColor(fg);
  lcd().drawString(s.c_str(), x, y);
}

uint32_t gClearMs = 0;

void clear() {
  clearButtons();
  gHeader = false;
  gClearMs = millis();
  lcd().fillScreen(color::kBg);
}

uint32_t lastClearMs() { return gClearMs; }

void header(const String& title, bool back) {
  gHeader = true;
  lcd().fillRect(0, 0, kW, kHeaderH, color::kHeader);
  int x = kMargin + 2;
  if (back) {
    Button& b = addButton(0, 0, 44, kHeaderH, kIdBack, "", Style::Normal, 0, Icon::Back);
    drawButton(b);
    x = 50;
  }
  fontBold();
  text(fit(title, kW - x - 50), x, kHeaderH / 2, color::kText, textdatum_t::middle_left);
  headerClock();
}

void headerClock() {
  if (!gHeader) return;
  lcd().fillRect(kW - 46, 0, 46, kHeaderH, color::kHeader);
  if (!envdata::timeValid()) return;
  const time_t t = envdata::now();
  tm local{};
  localtime_r(&t, &local);
  char buf[8];
  strftime(buf, sizeof buf, "%H:%M", &local);
  fontSmall();
  text(buf, kW - kMargin, kHeaderH / 2, color::kMuted, textdatum_t::middle_right);
}

void clearButtons() {
  gCount = 0;
  gPressed = -1;
}

Button& addButton(int x, int y, int w, int h, uint8_t id, const char* label, Style style, uint8_t flags, Icon icon) {
  static Button overflow;
  Button* slot = nullptr;
  for (int i = 0; i < gCount && id != kIdNone; ++i)
    if (gButtons[i].id == id) slot = &gButtons[i];  // redrawn (pager, rating row): same slot
  if (!slot) {
    if (gCount >= kMaxButtons) return overflow;
    slot = &gButtons[gCount++];
  }
  Button& b = *slot;
  b = Button();
  b.x = x;
  b.y = y;
  b.w = w;
  b.h = h;
  b.id = id;
  b.flags = flags;
  b.style = style;
  b.icon = icon;
  strlcpy(b.label, label ? label : "", sizeof b.label);
  return b;
}

Button* button(uint8_t id) {
  for (int i = 0; i < gCount; ++i)
    if (gButtons[i].id == id) return &gButtons[i];
  return nullptr;
}

void drawButton(const Button& b, bool pressed) {
  if (b.flags & kNoDraw) return;
  auto& d = lcd();
  uint16_t bg = color::kPanel, fg = color::kText;
  switch (b.style) {
    case Style::Normal: bg = pressed ? color::kPanelHi : color::kPanel; break;
    case Style::Primary: bg = pressed ? color::kAccentHi : color::kAccent; fg = TFT_WHITE; break;
    case Style::Danger: bg = pressed ? color::kBadHi : color::kBad; fg = TFT_WHITE; break;
    case Style::Warn: bg = pressed ? color::kText : color::kWarn; fg = TFT_BLACK; break;
    case Style::Ghost: bg = pressed ? color::kPanel : color::kBg; fg = color::kMuted; break;
    case Style::Selected: bg = pressed ? color::kAccent : color::kAccentHi; fg = TFT_BLACK; break;
    case Style::Row: bg = pressed ? color::kPanelHi : color::kBg; break;
  }
  if (b.style == Style::Row) {
    d.fillRect(b.x, b.y, b.w, b.h - 1, bg);
    d.drawFastHLine(b.x, b.y + b.h - 1, b.w, color::kLine);
    if (b.h >= 56) {  // two lines of label, one of sub
      fontBody();
      drawWrapped(b.label, b.x + kMargin, b.y + 3, b.w - 28, fg, b.y + 3 + 2 * lineHeight());
      fontSmall();
      text(fit(b.sub, b.w - 28), b.x + kMargin, b.y + b.h - 17, color::kMuted);
      drawIcon(Icon::Right, b.x + b.w - 12, b.y + b.h / 2, color::kLine);
    } else if (b.h >= 44) {
      fontBody();
      text(fit(b.label, b.w - 28), b.x + kMargin, b.y + 5, fg);
      fontSmall();
      text(fit(b.sub, b.w - 28), b.x + kMargin, b.y + b.h - 18, color::kMuted);
      drawIcon(Icon::Right, b.x + b.w - 12, b.y + b.h / 2, color::kLine);
    } else {
      fontSmall();
      const int subW = b.sub[0] ? d.textWidth(b.sub) + 8 : 0;
      text(b.sub, b.x + b.w - kMargin, b.y + b.h / 2, color::kMuted, textdatum_t::middle_right);
      fontBody();
      text(fit(b.label, b.w - 2 * kMargin - subW), b.x + kMargin, b.y + b.h / 2, fg, textdatum_t::middle_left);
    }
    return;
  }
  d.fillRoundRect(b.x, b.y, b.w, b.h, 6, bg);
  if (b.style == Style::Ghost) d.drawRoundRect(b.x, b.y, b.w, b.h, 6, color::kLine);
  if (b.icon != Icon::None && !b.label[0]) {
    drawIcon(b.icon, b.x + b.w / 2, b.y + b.h / 2, fg);
    return;
  }
  int cx = b.x + b.w / 2;
  int room = b.w - 10;
  if (b.icon != Icon::None) {
    drawIcon(b.icon, b.x + 16, b.y + b.h / 2, fg);
    cx += 12;
    room -= 26;
  }
  if (b.style == Style::Danger) fontBold();
  else fontBody();
  text(fit(b.label, room), cx, b.y + b.h / 2, fg, textdatum_t::middle_center);
}

void setButton(uint8_t id, const char* label, Style style) {
  Button* b = button(id);
  if (!b) return;
  strlcpy(b->label, label, sizeof b->label);
  b->style = style;
  drawButton(*b);
}

void pager(int page, int pages, int y) {
  lcd().fillRect(0, y, kW, kFooterH, color::kBg);
  if (pages <= 1) return;
  drawButton(addButton(kMargin, y, 76, kFooterH, kIdPrev, "", page > 0 ? Style::Normal : Style::Ghost, kRepeat, Icon::Up));
  drawButton(addButton(kW - kMargin - 76, y, 76, kFooterH, kIdNext, "", page + 1 < pages ? Style::Normal : Style::Ghost,
                       kRepeat, Icon::Down));
  fontSmall();
  text(String(page + 1) + " / " + String(pages), kW / 2, y + kFooterH / 2, color::kMuted, textdatum_t::middle_center);
}

TouchEvent pollTouch() {
  TouchEvent e;
  const uint32_t now = millis();
  if (now - gLastPoll < 8) return e;
  gLastPoll = now;
  int32_t x = -1, y = -1;
  bool touched = lcd().getTouch(&x, &y) > 0;
  if (touched && (x < 0 || y < 0 || x >= kW || y >= kH)) touched = false;
  if (touched) {
    gUpCount = 0;
    gX = x;
    gY = y;
    if (!gDown) {
      if (++gDownCount < 2) return e;  // two readings in a row: not a glitch
      gDown = true;
      gLastTouch = now;
      e.type = TouchEvent::Down;
    } else {
      e.type = TouchEvent::Hold;
    }
    e.x = gX;
    e.y = gY;
    return e;
  }
  gDownCount = 0;
  if (gDown && ++gUpCount >= 3) {
    gDown = false;
    gLastTouch = now;
    e.type = TouchEvent::Up;
    e.x = gX;
    e.y = gY;
  }
  return e;
}

uint32_t lastTouchMs() { return gLastTouch; }

void cancelPress() { gPressed = -1; }

uint8_t handleTouch(const TouchEvent& e, int16_t& x, int16_t& y) {
  x = e.x;
  y = e.y;
  const uint32_t now = millis();
  switch (e.type) {
    case TouchEvent::Down: {
      const int i = hit(e.x, e.y);
      if (i < 0) return kIdNone;
      const Button& b = gButtons[i];
      if (b.flags & kOnPress) {
        gPressed = -1;
        return b.id;
      }
      gPressed = i;
      gRepeated = false;
      gPressMs = gRepeatMs = now;
      drawButton(b, true);
      return kIdNone;
    }
    case TouchEvent::Hold: {
      if (gPressed < 0) return kIdNone;
      const Button& b = gButtons[gPressed];
      if (!inside(b, e.x, e.y, 14)) {
        drawButton(b, false);
        gPressed = -1;
        return kIdNone;
      }
      if ((b.flags & kRepeat) && now - gPressMs > 450 && now - gRepeatMs > 110) {
        gRepeatMs = now;
        gRepeated = true;
        return b.id;
      }
      return kIdNone;
    }
    case TouchEvent::Up: {
      if (gPressed < 0) return kIdNone;
      const Button b = gButtons[gPressed];
      gPressed = -1;
      drawButton(b, false);
      return gRepeated ? kIdNone : b.id;
    }
    case TouchEvent::None: break;
  }
  return kIdNone;
}

}  // namespace ui
