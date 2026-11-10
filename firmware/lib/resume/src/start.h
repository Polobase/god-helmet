// Starting a session twice with the same token starts it once.
//
// The app sends a random token with every start. If the reply gets lost
// (the link dropped just then), the app does not know whether the session
// runs; it repeats the request with the same token and gets the same session
// back. A different or missing token while something runs is refused as before.
#pragma once

namespace resume {

constexpr int kTokenMax = 24;  // characters, plus the terminator

// 1..24 characters from A-Z a-z 0-9 _ -
bool validToken(const char* token);

enum class StartDecision { Start, Already, Busy };

// `knownToken`: the token of the session that runs, or of the last one started
// since boot ("" when none). `busy`: a session or test is running or queued.
StartDecision decideStart(bool busy, const char* knownToken, const char* requestToken);

}  // namespace resume
