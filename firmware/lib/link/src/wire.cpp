#include "wire.h"

#include <cstdio>
#include <cstring>

namespace hlink {
namespace {

// The integer after "key": within the first `n` bytes, or 0.
long long member(const char* data, size_t n, const char* key) {
  const size_t klen = std::strlen(key);
  for (size_t i = 0; i + klen < n; ++i) {
    if (data[i] != '"' || std::memcmp(data + i + 1, key, klen) != 0 || i + klen + 1 >= n || data[i + klen + 1] != '"') continue;
    size_t p = i + klen + 2;
    while (p < n && (data[p] == ' ' || data[p] == ':')) ++p;
    long long v = 0;
    int digits = 0;
    while (p < n && data[p] >= '0' && data[p] <= '9' && digits < 18) {
      v = v * 10 + (data[p] - '0');
      ++p;
      ++digits;
    }
    return digits ? v : 0;
  }
  return 0;
}

}  // namespace

void peekTag(const char* data, size_t n, long long& c, long long& id) {
  if (n > 96) n = 96;  // both sit at the very start; never scan a whole program
  c = member(data, n, "c");
  id = member(data, n, "id");
}

std::string errorReply(long long c, long long id, const char* error) {
  std::string out = "{\"c\":" + std::to_string(c) + ",\"id\":" + std::to_string(id) + ",\"ok\":false,\"error\":\"";
  for (const char* p = error; *p; ++p) {
    if (*p == '"' || *p == '\\') out += '\\';
    if (static_cast<unsigned char>(*p) >= 0x20) out += *p;
  }
  out += "\"}";
  return out;
}

}  // namespace hlink
