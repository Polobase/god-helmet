#include "start.h"

#include <cstring>

namespace resume {

bool validToken(const char* token) {
  if (token == nullptr) return false;
  const size_t n = std::strlen(token);
  if (n < 1 || n > static_cast<size_t>(kTokenMax)) return false;
  for (size_t i = 0; i < n; ++i) {
    const char ch = token[i];
    const bool ok = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-';
    if (!ok) return false;
  }
  return true;
}

StartDecision decideStart(bool busy, const char* knownToken, const char* requestToken) {
  const bool has = requestToken != nullptr && requestToken[0] != '\0';
  if (has && knownToken != nullptr && std::strcmp(knownToken, requestToken) == 0) return StartDecision::Already;
  return busy ? StartDecision::Busy : StartDecision::Start;
}

}  // namespace resume
