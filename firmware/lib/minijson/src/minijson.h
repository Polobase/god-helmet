// Small JSON DOM parser and writer (no external dependencies).
// Enough for presets, settings and the web API; not a general-purpose library.
#pragma once
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

namespace mj {

class Value {
 public:
  enum class Type { Null, Bool, Number, String, Array, Object };

  Type type() const { return type_; }
  bool isNull() const { return type_ == Type::Null; }
  bool isNumber() const { return type_ == Type::Number; }
  bool isString() const { return type_ == Type::String; }
  bool isArray() const { return type_ == Type::Array; }
  bool isObject() const { return type_ == Type::Object; }

  // Lookups never fail: a missing key/index yields a shared null value.
  const Value& operator[](const char* key) const;
  const Value& operator[](size_t index) const;
  const Value& operator[](int index) const {  // avoids 0 -> const char* ambiguity
    return index < 0 ? (*this)[static_cast<size_t>(-1)] : (*this)[static_cast<size_t>(index)];
  }
  bool has(const char* key) const;
  size_t size() const;

  double num(double fallback = 0) const;
  bool boolean(bool fallback = false) const;
  const char* str(const char* fallback = "") const;
  const std::vector<std::pair<std::string, Value>>& members() const { return object_; }

 private:
  friend class Parser;
  Type type_ = Type::Null;
  bool bool_ = false;
  double number_ = 0;
  std::string string_;
  std::vector<Value> array_;
  std::vector<std::pair<std::string, Value>> object_;
};

// Returns false on malformed input; `error` gets a short description.
bool parse(const char* text, size_t length, Value& out, std::string* error = nullptr);
inline bool parse(const std::string& text, Value& out, std::string* error = nullptr) {
  return parse(text.data(), text.size(), out, error);
}

// Streaming writer: w.beginObject(); w.key("a"); w.number(1); w.endObject();
class Writer {
 public:
  Writer& beginObject();
  Writer& endObject();
  Writer& beginArray();
  Writer& endArray();
  Writer& key(const char* k);
  Writer& string(const char* s);
  Writer& string(const std::string& s) { return string(s.c_str()); }
  Writer& number(double v, int decimals = 4);
  Writer& integer(long long v);
  Writer& boolean(bool v);
  Writer& null();
  Writer& raw(const char* json);  // pre-serialised JSON value

  const std::string& str() const { return out_; }
  std::string take() { return std::move(out_); }

 private:
  void separator();
  std::string out_;
  std::vector<bool> first_;     // per nesting level: no element written yet
  bool afterKey_ = false;
};

void appendEscaped(std::string& out, const char* s);

}  // namespace mj
