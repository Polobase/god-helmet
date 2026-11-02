// Minimal Arduino core for the host UI screenshot tool (test/uisim): just what
// src/ui and the headers it includes use. Not a general Arduino emulation.
#pragma once
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <type_traits>

uint32_t millis();
void delay(uint32_t ms);
constexpr int LOW = 0, HIGH = 1;
int digitalRead(int pin);

class String {
 public:
  String() = default;
  String(const char* s) : s_(s ? s : "") {}
  String(const std::string& s) : s_(s) {}
  String(char c) : s_(1, c) {}
  template <typename T, typename std::enable_if<std::is_integral<T>::value && !std::is_same<T, char>::value &&
                                                    !std::is_same<T, bool>::value,
                                                int>::type = 0>
  explicit String(T v) : s_(std::to_string(v)) {}
  explicit String(double v, unsigned decimals = 2) {
    char b[64];
    std::snprintf(b, sizeof b, "%.*f", static_cast<int>(decimals), v);
    s_ = b;
  }
  explicit String(float v, unsigned decimals = 2) : String(static_cast<double>(v), decimals) {}

  const char* c_str() const { return s_.c_str(); }
  unsigned length() const { return static_cast<unsigned>(s_.size()); }
  bool isEmpty() const { return s_.empty(); }
  bool reserve(unsigned n) {
    s_.reserve(n);
    return true;
  }
  char operator[](unsigned i) const { return i < s_.size() ? s_[i] : 0; }
  String substring(unsigned from) const { return from < s_.size() ? String(s_.substr(from)) : String(); }
  String substring(unsigned from, unsigned to) const {
    if (from > to) std::swap(from, to);
    if (from >= s_.size()) return String();
    return String(s_.substr(from, to - from));
  }
  int indexOf(char c, unsigned from = 0) const {
    const size_t i = s_.find(c, from);
    return i == std::string::npos ? -1 : static_cast<int>(i);
  }
  bool startsWith(const String& p) const { return s_.compare(0, p.s_.size(), p.s_) == 0; }
  bool endsWith(const String& p) const {
    return s_.size() >= p.s_.size() && s_.compare(s_.size() - p.s_.size(), p.s_.size(), p.s_) == 0;
  }
  void trim() {
    const size_t a = s_.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) {
      s_.clear();
      return;
    }
    s_ = s_.substr(a, s_.find_last_not_of(" \t\r\n") - a + 1);
  }
  void remove(unsigned index) {
    if (index < s_.size()) s_.erase(index);
  }
  void remove(unsigned index, unsigned count) {
    if (index < s_.size()) s_.erase(index, count);
  }
  long toInt() const { return std::atol(s_.c_str()); }
  float toFloat() const { return static_cast<float>(std::atof(s_.c_str())); }

  String& operator+=(const String& o) {
    s_ += o.s_;
    return *this;
  }
  String& operator+=(const char* o) {
    s_ += o ? o : "";
    return *this;
  }
  String& operator+=(char c) {
    s_ += c;
    return *this;
  }

  friend String operator+(const String& a, const String& b) { return String(a.s_ + b.s_); }
  friend bool operator==(const String& a, const String& b) { return a.s_ == b.s_; }
  friend bool operator==(const String& a, const char* b) { return a.s_ == (b ? b : ""); }
  friend bool operator==(const char* a, const String& b) { return b == a; }
  friend bool operator!=(const String& a, const String& b) { return !(a == b); }
  friend bool operator!=(const String& a, const char* b) { return !(a == b); }

 private:
  std::string s_;
};

struct EspClass {
  void restart();
  uint32_t getFreeHeap() const { return 142 * 1024; }
  uint64_t getEfuseMac() const { return 0; }
};
extern EspClass ESP;
