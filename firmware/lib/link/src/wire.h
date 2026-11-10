// Replies for requests that never reached the request handler (dropped
// because the inbox was full, too large, or damaged in transit), so the app
// hears at once instead of waiting for its own timeout.
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>

namespace hlink {

// Reads "c" and "id" from the start of a request. The app writes them as its
// first two members, so the first packet is enough. Missing ones stay 0.
void peekTag(const char* data, size_t n, long long& c, long long& id);

// {"c":<c>,"id":<id>,"ok":false,"error":"<error>"}
std::string errorReply(long long c, long long id, const char* error);

}  // namespace hlink
