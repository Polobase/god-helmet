#include "pack.h"

#include <cstdio>
#include <string>

#include "../sdcard.h"
#include "minijson.h"

namespace pack {
namespace {

String path(const char* name) { return String(sdcard::kRoot) + "/" + name; }

int split(const String& line, char sep, String* out, int max) {
  int n = 0, start = 0;
  while (n < max) {
    const int i = line.indexOf(sep, start);
    out[n++] = i < 0 ? line.substring(start) : line.substring(start, i);
    if (i < 0) break;
    start = i + 1;
  }
  return n;
}

String numbered(const char* dir, int num, const char* ext) {
  char buf[32];
  std::snprintf(buf, sizeof buf, "%s/%s/%03d.%s", sdcard::kRoot, dir, num, ext);
  return buf;
}

}  // namespace

bool check(int& programs, String& error) {
  programs = 0;
  bool ok = false;
  error = "index.tsv is empty";
  const bool read = sdcard::forEachLine(path("index.tsv"), [&](const String& line) {
    String f[4];
    if (split(line, '\t', f, 4) >= 3 && f[0] == "#godhelmet-pack") {
      if (f[1].toInt() != kVersion) {
        error = "program pack version " + f[1] + ", this firmware reads version " + String(kVersion) +
                ": rebuild it (npm run sd-pack)";
      } else {
        programs = f[2].toInt();
        ok = true;
      }
    } else {
      error = "index.tsv is not a program pack";
    }
    return false;  // header only
  }, error);
  if (!read && error.startsWith("not on the card")) error = "no program pack on the card (godhelmet/index.tsv)";
  if (read && ok && programs <= 0) {
    error = "the program pack has no programs";
    ok = false;
  }
  return read && ok;
}

bool categories(std::vector<Category>& out, String& error) {
  out.clear();
  return sdcard::forEachLine(path("categories.tsv"), [&](const String& line) {
    String f[3];
    if (split(line, '\t', f, 3) == 3) {
      Category c;
      c.key = f[0];
      c.label = f[1];
      c.count = f[2].toInt();
      out.push_back(c);
    }
    return true;
  }, error);
}

bool programs(const String& category, std::vector<Program>& out, String& error) {
  out.clear();
  return sdcard::forEachLine(path("index.tsv"), [&](const String& line) {
    if (line.startsWith("#")) return true;
    String f[9];
    if (split(line, '\t', f, 9) < 9 || f[2] != category) return true;
    Program p;
    p.num = f[0].toInt();
    p.id = f[1];
    p.category = f[2];
    p.evidence = f[3];
    p.seconds = f[4].toInt();
    p.coils = f[5].toInt();
    split(f[6], ',', p.sites, 8);
    p.name = f[7];
    p.placement = f[8];
    out.push_back(p);
    return true;
  }, error);
}

String programPath(int num) { return numbered("p", num, "json"); }
String textPath(int num) { return numbered("t", num, "txt"); }

bool sites(std::vector<SitePos>& out, String& error) {
  out.clear();
  return sdcard::forEachLine(path("sites.tsv"), [&](const String& line) {
    String f[4];
    if (split(line, '\t', f, 4) == 4) {
      SitePos s;
      strlcpy(s.name, f[0].c_str(), sizeof s.name);
      s.x = f[1].toFloat();
      s.y = f[2].toFloat();
      s.tenTen = f[3] == "1";
      out.push_back(s);
    }
    return true;
  }, error);
}

bool tapeTemplate(engine::tape::Template& out, String& error) {
  std::string json;
  if (!sdcard::readFile(path("tape.json"), json, 8192, error)) return false;
  mj::Value v;
  if (!mj::parse(json, v) || !engine::tape::templateFromJson(v, out)) {
    error = "tape.json unreadable";
    return false;
  }
  return true;
}

}  // namespace pack
