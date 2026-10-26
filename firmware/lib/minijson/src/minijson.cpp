#include "minijson.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace mj {
namespace {

const Value& nullValue() {
  static const Value v;
  return v;
}

void appendUtf8(std::string& out, unsigned cp) {
  if (cp < 0x80) {
    out += static_cast<char>(cp);
  } else if (cp < 0x800) {
    out += static_cast<char>(0xC0 | (cp >> 6));
    out += static_cast<char>(0x80 | (cp & 0x3F));
  } else if (cp < 0x10000) {
    out += static_cast<char>(0xE0 | (cp >> 12));
    out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
    out += static_cast<char>(0x80 | (cp & 0x3F));
  } else {
    out += static_cast<char>(0xF0 | (cp >> 18));
    out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
    out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
    out += static_cast<char>(0x80 | (cp & 0x3F));
  }
}

}  // namespace

const Value& Value::operator[](const char* key) const {
  if (type_ != Type::Object || key == nullptr) return nullValue();
  for (const auto& kv : object_)
    if (kv.first == key) return kv.second;
  return nullValue();
}

const Value& Value::operator[](size_t index) const {
  if (type_ != Type::Array || index >= array_.size()) return nullValue();
  return array_[index];
}

bool Value::has(const char* key) const { return !(*this)[key].isNull(); }

size_t Value::size() const {
  if (type_ == Type::Array) return array_.size();
  if (type_ == Type::Object) return object_.size();
  return 0;
}

double Value::num(double fallback) const {
  if (type_ == Type::Number) return number_;
  if (type_ == Type::Bool) return bool_ ? 1 : 0;
  return fallback;
}

bool Value::boolean(bool fallback) const {
  if (type_ == Type::Bool) return bool_;
  if (type_ == Type::Number) return number_ != 0;
  return fallback;
}

const char* Value::str(const char* fallback) const {
  return type_ == Type::String ? string_.c_str() : fallback;
}

class Parser {
 public:
  Parser(const char* p, const char* end) : p_(p), end_(end) {}

  bool parseDocument(Value& out, std::string* error) {
    skipWs();
    if (!parseValue(out, 0)) return fail(error);
    skipWs();
    if (p_ != end_) {
      err_ = "trailing characters";
      return fail(error);
    }
    return true;
  }

 private:
  static constexpr int kMaxDepth = 32;

  bool fail(std::string* error) {
    if (error) *error = err_ ? err_ : "parse error";
    return false;
  }

  void skipWs() {
    while (p_ < end_ && (*p_ == ' ' || *p_ == '\n' || *p_ == '\r' || *p_ == '\t')) ++p_;
  }

  bool literal(const char* word) {
    const size_t n = std::strlen(word);
    if (static_cast<size_t>(end_ - p_) < n || std::strncmp(p_, word, n) != 0) {
      err_ = "invalid literal";
      return false;
    }
    p_ += n;
    return true;
  }

  bool parseValue(Value& v, int depth) {
    if (depth > kMaxDepth) {
      err_ = "nesting too deep";
      return false;
    }
    if (p_ >= end_) {
      err_ = "unexpected end";
      return false;
    }
    switch (*p_) {
      case '{':
        return parseObject(v, depth);
      case '[':
        return parseArray(v, depth);
      case '"':
        v.type_ = Value::Type::String;
        return parseString(v.string_);
      case 't':
        v.type_ = Value::Type::Bool;
        v.bool_ = true;
        return literal("true");
      case 'f':
        v.type_ = Value::Type::Bool;
        v.bool_ = false;
        return literal("false");
      case 'n':
        v.type_ = Value::Type::Null;
        return literal("null");
      default:
        return parseNumber(v);
    }
  }

  bool parseNumber(Value& v) {
    const char* start = p_;
    if (p_ < end_ && (*p_ == '-' || *p_ == '+')) ++p_;
    while (p_ < end_ && ((*p_ >= '0' && *p_ <= '9') || *p_ == '.' || *p_ == 'e' || *p_ == 'E' ||
                         *p_ == '-' || *p_ == '+'))
      ++p_;
    if (p_ == start) {
      err_ = "unexpected character";
      return false;
    }
    std::string tmp(start, p_);
    char* endp = nullptr;
    v.number_ = std::strtod(tmp.c_str(), &endp);
    if (endp == nullptr || *endp != '\0') {
      err_ = "invalid number";
      return false;
    }
    v.type_ = Value::Type::Number;
    return true;
  }

  bool hex4(unsigned& cp) {
    if (end_ - p_ < 4) return false;
    cp = 0;
    for (int i = 0; i < 4; ++i) {
      const char c = *p_++;
      cp <<= 4;
      if (c >= '0' && c <= '9') cp |= c - '0';
      else if (c >= 'a' && c <= 'f') cp |= c - 'a' + 10;
      else if (c >= 'A' && c <= 'F') cp |= c - 'A' + 10;
      else return false;
    }
    return true;
  }

  bool parseString(std::string& out) {
    ++p_;  // opening quote
    while (p_ < end_) {
      const char c = *p_++;
      if (c == '"') return true;
      if (c != '\\') {
        out += c;
        continue;
      }
      if (p_ >= end_) break;
      const char e = *p_++;
      switch (e) {
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'u': {
          unsigned cp;
          if (!hex4(cp)) {
            err_ = "bad unicode escape";
            return false;
          }
          if (cp >= 0xD800 && cp <= 0xDBFF && end_ - p_ >= 6 && p_[0] == '\\' && p_[1] == 'u') {
            p_ += 2;
            unsigned lo;
            if (!hex4(lo)) {
              err_ = "bad unicode escape";
              return false;
            }
            cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
          }
          appendUtf8(out, cp);
          break;
        }
        default:
          err_ = "bad escape";
          return false;
      }
    }
    err_ = "unterminated string";
    return false;
  }

  bool parseArray(Value& v, int depth) {
    v.type_ = Value::Type::Array;
    ++p_;
    skipWs();
    if (p_ < end_ && *p_ == ']') {
      ++p_;
      return true;
    }
    while (true) {
      v.array_.emplace_back();
      skipWs();
      if (!parseValue(v.array_.back(), depth + 1)) return false;
      skipWs();
      if (p_ < end_ && *p_ == ',') {
        ++p_;
        continue;
      }
      if (p_ < end_ && *p_ == ']') {
        ++p_;
        return true;
      }
      err_ = "expected , or ]";
      return false;
    }
  }

  bool parseObject(Value& v, int depth) {
    v.type_ = Value::Type::Object;
    ++p_;
    skipWs();
    if (p_ < end_ && *p_ == '}') {
      ++p_;
      return true;
    }
    while (true) {
      skipWs();
      if (p_ >= end_ || *p_ != '"') {
        err_ = "expected key";
        return false;
      }
      v.object_.emplace_back();
      if (!parseString(v.object_.back().first)) return false;
      skipWs();
      if (p_ >= end_ || *p_ != ':') {
        err_ = "expected :";
        return false;
      }
      ++p_;
      skipWs();
      if (!parseValue(v.object_.back().second, depth + 1)) return false;
      skipWs();
      if (p_ < end_ && *p_ == ',') {
        ++p_;
        continue;
      }
      if (p_ < end_ && *p_ == '}') {
        ++p_;
        return true;
      }
      err_ = "expected , or }";
      return false;
    }
  }

  const char* p_;
  const char* end_;
  const char* err_ = nullptr;
};

bool parse(const char* text, size_t length, Value& out, std::string* error) {
  out = Value();
  if (text == nullptr) {
    if (error) *error = "no input";
    return false;
  }
  Parser parser(text, text + length);
  return parser.parseDocument(out, error);
}

void appendEscaped(std::string& out, const char* s) {
  out += '"';
  for (const char* p = s ? s : ""; *p; ++p) {
    const unsigned char c = static_cast<unsigned char>(*p);
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof buf, "\\u%04x", c);
          out += buf;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  out += '"';
}

void Writer::separator() {
  if (afterKey_) {
    afterKey_ = false;
    return;
  }
  if (!first_.empty()) {
    if (!first_.back()) out_ += ',';
    first_.back() = false;
  }
}

Writer& Writer::beginObject() {
  separator();
  out_ += '{';
  first_.push_back(true);
  return *this;
}

Writer& Writer::endObject() {
  out_ += '}';
  if (!first_.empty()) first_.pop_back();
  return *this;
}

Writer& Writer::beginArray() {
  separator();
  out_ += '[';
  first_.push_back(true);
  return *this;
}

Writer& Writer::endArray() {
  out_ += ']';
  if (!first_.empty()) first_.pop_back();
  return *this;
}

Writer& Writer::key(const char* k) {
  separator();
  appendEscaped(out_, k);
  out_ += ':';
  afterKey_ = true;
  return *this;
}

Writer& Writer::string(const char* s) {
  separator();
  appendEscaped(out_, s);
  return *this;
}

Writer& Writer::number(double v, int decimals) {
  separator();
  if (!std::isfinite(v)) {
    out_ += "null";
    return *this;
  }
  char buf[40];
  std::snprintf(buf, sizeof buf, "%.*f", decimals, v);
  // trim trailing zeros for compactness
  char* dot = std::strchr(buf, '.');
  if (dot) {
    char* end = buf + std::strlen(buf) - 1;
    while (end > dot && *end == '0') *end-- = '\0';
    if (end == dot) *end = '\0';
  }
  if (std::strcmp(buf, "-0") == 0) std::strcpy(buf, "0");
  out_ += buf;
  return *this;
}

Writer& Writer::integer(long long v) {
  separator();
  out_ += std::to_string(v);
  return *this;
}

Writer& Writer::boolean(bool v) {
  separator();
  out_ += v ? "true" : "false";
  return *this;
}

Writer& Writer::null() {
  separator();
  out_ += "null";
  return *this;
}

Writer& Writer::raw(const char* json) {
  separator();
  out_ += json;
  return *this;
}

}  // namespace mj
