#!/usr/bin/env python3
"""Collect every paper, thesis, report, patent and government document the project cites, and download the
open copies into library/.

    python3 tools/fetch_sources.py list              # sort the cited sources into kinds (no network)
    python3 tools/fetch_sources.py fetch             # find open copies and download them
    python3 tools/fetch_sources.py fetch --only cia  # one kind: paper, cia, thesis, patent, archive, nap, pdf, page
    python3 tools/fetch_sources.py report            # library/INDEX.md and library/ACCESS.md

Besides the cited sources, every PubMed paper of the searches in SEARCHES (the Persinger lab) is fetched.
ACCESS.md links each paywalled paper to swisscovery; set SWISSCOVERY_VID to your library's view to see its holdings.

library/ is git-ignored. Most papers are copyrighted: they are for reading here, never for this public repository.

Only the official routes are used: Europe PMC and OpenAlex for open-access copies of papers, the Internet Archive's
metadata API, the DSpace API of Laurentian University's repository, Google Patents' PDF links, and the PDF link a
publisher's page declares (citation_pdf_url). The script names itself in its User-Agent. A site that refuses it or
answers with a bot challenge is not worked around: the item is listed in ACCESS.md as "download in a browser".
"""
import argparse
import collections
import html
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library")
UA = "god-helmet-library/1.0 (fetches the sources cited in this project; python-urllib)"

# Files that cite sources. Hardware data sheets are left out: docs/WIRING.md links the vendors instead.
SKIP_PREFIX = ("hardware/", "firmware/", "webapp/test/", "webapp/public/", "site/test", "site/e2e", "site/public",
               "site/dist", "library/")
CITING_FILE = re.compile(r"\.(md|json|ts|vue|yaml)$")
URL = re.compile(r"https?://[^\s>\"`\]\\'<,|]+")
DOI = re.compile(r"\b(10\.\d{4,9}/[^\s>\"`\]\\'<,;|]+)")
CIA_ID = re.compile(r"\b(CIA-RDP\d{2}[A-Z]?-?\d{5}R\d{12}-\d|NSA-RDP\d{2}X\d{5}R\d{12}-\d)\b", re.I)
NOISE = re.compile(r"registry\.npmjs|github\.com|githubusercontent|localhost|\$\{|192\.168\.|opencollective|tidelift"
                   r"|paypal\.me|patreon|feross\.org|paulmillr|eslint\.org|dotenvx|sitemaps\.org|creativecommons"
                   r"|platformio\.org|espressif\.com|api\.crossref|eutils\.ncbi|webservices/rest/search|youtu"
                   r"|templateflow|neurosynth|neurovault|lcdwiki|sg-micro|aliexpress|ampetronic|polobase\.github"
                   r"|services\.swpc|kp\.gfz\.de/app|gnu\.org")

# Hosts whose landing page usually declares the PDF (citation_pdf_url) or whose page is the document.
SCHOLARLY = re.compile(r"jcer\.com|journalofscientificexploration|scirp\.org|journals\.lub\.lu\.se|uni-heidelberg"
                       r"|seemj|hal\.science|zenodo\.org|osf\.io|dare\.uva\.nl|lup\.lub\.lu\.se|uhra\.herts"
                       r"|pure\.au\.dk|researchprofiles\.herts|ntrs\.nasa\.gov|iris\.who\.int|who\.int/publications"
                       r"|academic\.oup\.com|nature\.com/articles|f1000research|frontiersin\.org|journals\.plos\.org"
                       r"|gutenberg\.org/ebooks|openlibrary\.org/books|wellcomecollection\.org/works|researchgate\.net"
                       r"|academia\.edu|drmc\.library\.adelaide|doi\.gin\.g-node|ideas\.repec|stralsakerhetsmyndigheten"
                       r"|standards\.ieee\.org|webstore\.iec\.ch|eur-lex\.europa\.eu|epsilon\.ac\.uk|metabunk\.org/attach"
                       r"|clinicaltrials\.gov|ics\.uci\.edu/~jutts|koestler-parapsychology")


def citing_files():
    out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True,
                         text=True, check=True).stdout.split("\n")
    return [f for f in out if f and not f.startswith(SKIP_PREFIX) and CITING_FILE.search(f)]


def label_before(text, start):
    """The citation text just before a link: a Markdown link's label, or the words since the last separator."""
    ctx = text[max(0, start - 300):start]
    if ctx.endswith("]("):
        i = ctx.rfind("[", 0, len(ctx) - 2)
        return re.sub(r"\s+", " ", ctx[i + 1:-2]).strip() if i >= 0 else ""
    cut = max(ctx.rfind(c) for c in ";\n\"|")
    words = re.sub(r"[*_`]", "", ctx[cut + 1:])
    return re.sub(r"\s+", " ", words).strip(" ([:-")[-200:]


def clean_url(u):
    u = u.rstrip(".;:*_")
    while u.endswith(")") and u.count("(") < u.count(")"):
        u = u[:-1]
    return u


def classify(url):
    """(kind, key, fetch info) for one link, or None for links that are not sources."""
    if NOISE.search(url):
        return None
    u = urllib.parse.unquote(url)
    m = CIA_ID.search(u)
    if m:
        return "cia", m.group(1).upper(), {"url": url}
    m = re.search(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/|ncbi\.nlm\.nih\.gov/pubmed/|europepmc\.org/(?:abstract|article)/MED/)(\d+)", u)
    if m:
        return "paper", "pmid:" + m.group(1), {}
    m = re.search(r"\b(PMC\d+)\b", u)
    if m:
        return "paper", "pmcid:" + m.group(1), {}
    m = re.search(r"(?:doi\.org/|frontiersin\.org/articles/)(10\.\d{4,9}/.+?)(?:/full|/abstract)?$", u)
    if m and "g-node" not in u:
        return "paper", "doi:" + m.group(1).lower(), {}
    m = re.search(r"journals\.plos\.org/\w+/article\?id=(10\.\d+/[^&]+)", u)
    if m:
        return "paper", "doi:" + m.group(1).lower(), {}
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([\w.]+?)(?:v\d+)?$", u)
    if m:
        return "paper", "arxiv:" + m.group(1), {"pdf": f"https://arxiv.org/pdf/{m.group(1)}"}
    m = re.search(r"laurentian\.scholaris\.ca/(?:items/([0-9a-f-]{36})|server/api/core/bitstreams/([0-9a-f-]{36}))", u)
    if m:
        if m.group(1):
            return "thesis", "laurentian:" + m.group(1), {"item": m.group(1)}
        return "thesis", "laurentian-file:" + m.group(2), {"pdf": url}
    m = re.search(r"patents\.google\.com/patent/(\w+?)(?:/\w\w)?/?$", u)
    if m:
        return "patent", "patent:" + m.group(1), {"page": f"https://patents.google.com/patent/{m.group(1)}/en"}
    m = re.search(r"nationalacademies\.org/(?:catalog|books|read)/(\d+)", u)
    if m:
        return "nap", "nap:" + m.group(1), {"record": m.group(1)}
    m = re.search(r"^https?://archive\.org/details/([^/?#]+)", u)
    if m:
        return "archive", "ia:" + m.group(1), {"item": m.group(1)}
    if re.search(r"\.pdf($|[?#])", u, re.I) or re.search(r"/article/download/|/bitstreams?/.+/content|get_pdf\.cfm", u):
        return "pdf", "url:" + url, {"pdf": url}
    if SCHOLARLY.search(u):
        return "page", "url:" + url, {"page": url}
    return "web", "url:" + url, {}


def collect():
    works = {}

    def add(kind, key, info, f, label, url=None):
        w = works.setdefault(key, {"key": key, "kind": kind, "urls": [], "cited_in": [], "labels": [], **info})
        if url and url not in w["urls"]:
            w["urls"].append(url)
        if f not in w["cited_in"]:
            w["cited_in"].append(f)
        if label and label not in w["labels"] and len(w["labels"]) < 3:
            w["labels"].append(label)

    for f in citing_files():
        try:
            text = open(os.path.join(ROOT, f), encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue
        spans = []
        for m in URL.finditer(text):
            url = clean_url(m.group(0))
            spans.append((m.start(), m.start() + len(url)))
            c = classify(url)
            if c:
                add(*c, f, label_before(text, m.start()), url)
        inside = lambda i: any(a <= i < b for a, b in spans)
        for m in DOI.finditer(text):  # DOIs written as text, not as links
            if not inside(m.start()):
                add("paper", "doi:" + clean_url(m.group(1)).lower(), {}, f, label_before(text, m.start()))
        for m in CIA_ID.finditer(text):  # document numbers named without a link
            if not inside(m.start()):
                add("cia", m.group(1).upper(), {}, f, label_before(text, m.start()))
    return works


# ----------------------------------------------------------------------------------------------------- network

class Refused(Exception):
    pass


def get(url, accept="*/*", timeout=60):
    """(status, content type, body, final URL). A download that trickles is given up: it must finish within
    `timeout` seconds plus one second per 200 kB announced."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            size = int(r.headers.get("content-length") or 0)
            deadline = time.monotonic() + timeout + size / 200e3
            chunks = []
            while chunk := r.read(1 << 16):
                chunks.append(chunk)
                if time.monotonic() > deadline:
                    raise Refused(f"too slow (gave up after {timeout + size / 200e3:.0f} s)")
            return r.status, r.headers.get("content-type", ""), b"".join(chunks), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), b"", url
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        raise Refused(str(getattr(e, "reason", e)))


def get_json(url):
    status, _, body, _ = get(url, "application/json")
    if status != 200:
        raise Refused(f"HTTP {status}")
    return json.loads(body)


def europepmc(query):
    q = urllib.parse.quote(query)
    d = get_json(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&resultType=core"
                 f"&format=json&pageSize=100")
    return d.get("resultList", {}).get("result", [])


# PubMed searches whose every paper belongs in the library, besides the ones the project cites: the Persinger lab.
# "Koren SA" alone also finds Shon A. Koren (tau and mitochondria, 2018 on); Stanley Koren published only with Persinger.
SEARCHES = ["Persinger MA[Author]", "Koren SA[Author] AND Persinger MA[Author]"]


def add_searches(works, state, refresh):
    """The PMIDs of SEARCHES (PubMed E-utilities), as papers "cited in" the search. Cached in index.json."""
    found = state.setdefault("searches", {})
    for term in SEARCHES:
        if refresh or term not in found:
            q = urllib.parse.quote(term)
            d = get_json(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json"
                         f"&retmax=5000&tool=god-helmet-library&term={q}")
            found[term] = d["esearchresult"]["idlist"]
            time.sleep(0.4)
        for pmid in found.get(term, []):
            w = works.setdefault("pmid:" + pmid, {"key": "pmid:" + pmid, "kind": "paper", "urls": [
                f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"], "cited_in": [], "labels": []})
            if f"PubMed: {term}" not in w["cited_in"]:
                w["cited_in"].append(f"PubMed: {term}")


def resolve_papers(works, cache):
    """Title, authors, year, journal, DOI and open-access copies for papers named by PMID, PMCID or DOI."""
    todo = [w for w in works.values() if w["kind"] == "paper" and w["key"] not in cache]
    by_type = collections.defaultdict(list)
    for w in todo:
        t, v = w["key"].split(":", 1)
        by_type[t].append(v)
    field = {"pmid": "EXT_ID", "pmcid": "PMCID", "doi": "DOI"}
    for t, ids in by_type.items():
        if t not in field:
            continue
        for i in range(0, len(ids), 40):
            batch = ids[i:i + 40]
            q = " OR ".join(f'{field[t]}:"{v}"' for v in batch)
            if t == "pmid":
                q = f"({q}) AND SRC:MED"
            for r in europepmc(q):
                meta = {
                    "title": r.get("title", "").rstrip("."), "authors": r.get("authorString", ""),
                    "year": r.get("pubYear", ""), "journal": (r.get("journalInfo") or {}).get("journal", {}).get(
                        "medlineAbbreviation") or r.get("bookOrReportDetails", {}).get("publisher", ""),
                    "doi": (r.get("doi") or "").lower(), "pmid": r.get("pmid", ""), "pmcid": r.get("pmcid", ""),
                    "oa": r.get("isOpenAccess") == "Y",
                    "links": [u["url"] for u in (r.get("fullTextUrlList") or {}).get("fullTextUrl", [])
                              if u.get("availabilityCode") in ("OA", "F") and u.get("documentStyle") == "pdf"],
                }
                for k in (f"pmid:{meta['pmid']}", f"pmcid:{meta['pmcid']}", f"doi:{meta['doi']}"):
                    if k in works or k.split(":", 1)[1] in batch:
                        cache[k] = meta
            time.sleep(0.3)
    # DOIs Europe PMC does not know (books, many parapsychology journals): OpenAlex.
    for w in works.values():
        if w["kind"] != "paper" or w["key"] in cache or not w["key"].startswith("doi:"):
            continue
        doi = w["key"][4:]
        try:
            d = get_json("https://api.openalex.org/works/doi:" + urllib.parse.quote(doi, safe="/"))
        except Refused as e:
            cache[w["key"]] = {"error": str(e), "doi": doi}
            continue
        cache[w["key"]] = openalex_meta(d)
        time.sleep(0.2)
    # Open copies of papers Europe PMC knows only as abstracts: OpenAlex by DOI.
    for meta in list(cache.values()):
        if meta.get("doi") and not meta.get("pmcid") and not meta.get("links") and "oa_checked" not in meta:
            try:
                d = get_json("https://api.openalex.org/works/doi:" + urllib.parse.quote(meta["doi"], safe="/"))
                meta["links"] = openalex_meta(d)["links"]
            except Refused:
                pass
            meta["oa_checked"] = True
            time.sleep(0.2)


def openalex_meta(d):
    loc = [l for l in d.get("locations") or [] if l.get("pdf_url") and l.get("is_oa")]
    src = (d.get("primary_location") or {}).get("source") or {}
    return {
        "title": d.get("title") or "", "year": str(d.get("publication_year") or ""),
        "authors": ", ".join(a["author"]["display_name"] for a in (d.get("authorships") or [])[:6]),
        "journal": src.get("display_name") or "", "publisher": src.get("host_organization_name") or "",
        "doi": (d.get("doi") or "").replace("https://doi.org/", "").lower(), "pmid": "", "pmcid": "",
        "oa": bool((d.get("open_access") or {}).get("is_oa")), "links": [l["pdf_url"] for l in loc],
        "oa_checked": True,
    }


def is_pdf(body):
    return body[:1024].lstrip().startswith(b"%PDF")


def citation_pdf_url(page_url):
    status, ctype, body, final = get(page_url, "text/html")
    if status != 200 or "html" not in ctype:
        raise Refused(f"HTTP {status}")
    m = re.search(rb'<meta[^>]+name="citation_pdf_url"[^>]+content="([^"]+)"', body) or \
        re.search(rb'<meta[^>]+content="([^"]+)"[^>]+name="citation_pdf_url"', body)
    return urllib.parse.urljoin(final, html.unescape(m.group(1).decode())) if m else None


def download(urls, dest):
    """The first of `urls` that answers with a PDF, saved to dest. Returns (url, None) or (None, reason)."""
    reasons = []
    for u in urls:
        try:
            status, ctype, body, _ = get(u, "application/pdf", timeout=120)
        except Refused as e:
            reasons.append(f"{host(u)}: {e}")
            continue
        if status == 200 and is_pdf(body):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as fh:
                fh.write(body)
            return u, None
        reasons.append(f"{host(u)}: " + (f"HTTP {status}" if status != 200 else f"not a PDF ({ctype.split(';')[0]})"))
        time.sleep(0.5)
    return None, "; ".join(reasons) or "no open copy found"


def host(u):
    return urllib.parse.urlparse(u).netloc.removeprefix("www.")


def slug(s, n=70):
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()[:n].rstrip() or "untitled"


def file_name(w, meta):
    """Year - first author - title for papers and theses; the citation's label and the document number otherwise."""
    if meta.get("title"):
        meta = {**meta, "title": re.sub(r"<[^>]+>", "", html.unescape(meta["title"]))}  # <i>in vivo</i>
        first = (meta.get("authors") or "").split(",")[0].strip()
        first = first.split()[0] if first else ""
        return slug(" - ".join(x for x in (meta.get("year") or "", first, meta["title"]) if x), 110) + ".pdf"
    label = w["labels"][0] if w["labels"] else ""
    key = w["key"]
    short = key if w["kind"] == "cia" else key.split(":", 1)[1] if not key.startswith(("url:", "laurentian")) else ""
    if key.startswith("url:"):
        short = host(key[4:]) + " " + os.path.splitext(os.path.basename(urllib.parse.unquote(
            urllib.parse.urlparse(key[4:]).path.rstrip("/"))))[0][:40]
    return slug(" - ".join(x for x in (short, label) if x), 110) + ".pdf"


def candidates(w, meta):
    """Download URLs to try, best first."""
    kind, urls = w["kind"], []
    if kind == "paper":
        if meta.get("pmcid"):
            # PMC's articles on AWS Open Data (no bot check): the PDF where PMC has one, in its latest version.
            urls += [u for u in pmc_files(meta["pmcid"]) if u.endswith(".pdf")]
            urls.append(f"https://europepmc.org/articles/{meta['pmcid']}?pdf=render")
        urls += meta.get("links", [])
        if w.get("pdf"):
            urls.append(w["pdf"])
    elif kind == "cia":
        cid = w["key"]
        urls += [u for u in w["urls"] if re.search(r"\.pdf$", u, re.I)]
        ia = "cia-readingroom-document-" + cid.lower()
        urls += ia_pdfs(ia)
        urls.append(f"https://www.cia.gov/readingroom/docs/{cid}.pdf")
    elif kind == "thesis":
        urls += [w["pdf"]] if w.get("pdf") else dspace_pdfs(w["item"])
    elif kind == "patent":
        p = citation_pdf_url(w["page"])
        urls += [p] if p else []
    elif kind == "archive":
        urls += ia_pdfs(w["item"])
    elif kind == "nap":
        urls.append(f"https://nap.nationalacademies.org/cart/download.cgi?record_id={w['record']}")
    elif kind == "pdf":
        u = w["pdf"]
        m = re.match(r"(https?://web\.archive\.org/web/\d+)(?:id_)?(/.*)", u)
        urls.append(f"{m.group(1)}id_{m.group(2)}" if m else u)  # the archived file itself, without the toolbar
    elif kind == "page":
        p = citation_pdf_url(w["page"])
        urls += [p] if p else []
    return list(dict.fromkeys(urls))


def ia_pdfs(item):
    try:
        d = get_json(f"https://archive.org/metadata/{urllib.parse.quote(item)}")
    except Refused:
        return []
    files = [f for f in d.get("files", []) if f.get("name", "").lower().endswith(".pdf")
             and not f["name"].lower().endswith("_text.pdf")]
    restricted = d.get("metadata", {}).get("access-restricted-item") in ("true", True)
    if restricted:
        raise Refused("borrow-only on the Internet Archive (in copyright)")
    return [f"https://archive.org/download/{urllib.parse.quote(item)}/{urllib.parse.quote(f['name'])}" for f in files]


DSPACE = "https://laurentian.scholaris.ca/server/api/core"


def dspace_meta(item=None, bitstream=None):
    """Title, author and year of a thesis in Laurentian's repository, by item or by one of its files."""
    if bitstream:
        bundle = get_json(f"{DSPACE}/bitstreams/{bitstream}/bundle")
        item = get_json(bundle["_links"]["item"]["href"])["uuid"]
    md = get_json(f"{DSPACE}/items/{item}")["metadata"]
    val = lambda k: (md.get(k) or [{}])[0].get("value", "")
    return {"title": val("dc.title"), "authors": val("dc.contributor.author"), "year": val("dc.date.issued")[:4],
            "item": item}


def dspace_pdfs(item):
    base = DSPACE
    bundles = get_json(f"{base}/items/{item}/bundles")["_embedded"]["bundles"]
    out = []
    for b in bundles:
        if b["name"] == "ORIGINAL":
            for bs in get_json(b["_links"]["bitstreams"]["href"])["_embedded"]["bitstreams"]:
                if bs["name"].lower().endswith(".pdf"):
                    out.append(f"{base}/bitstreams/{bs['uuid']}/content")
    return out


FOLDER = {"paper": "papers", "cia": "government", "thesis": "theses", "patent": "patents", "archive": "archive",
          "nap": "reports", "pdf": "documents", "page": "papers"}


def fetch(works, only=None):
    state_path = os.path.join(LIB, "index.json")
    state = json.load(open(state_path)) if os.path.exists(state_path) else {"meta": {}, "items": {}}
    cache, items = state["meta"], state["items"]
    if not only or only == "paper":
        try:
            add_searches(works, state, refresh=True)
            resolve_papers(works, cache)
        except Refused as e:
            print("Europe PMC / OpenAlex not reachable:", e)
        json.dump(state, open(state_path, "w"), indent=1)
    # One download per paper even when it is cited by PMID, PMCID and DOI: group by the paper's identity.
    groups = collections.defaultdict(list)
    for w in sorted(works.values(), key=lambda w: (w["kind"], w["key"])):
        if w["kind"] == "web" or (only and w["kind"] != only):
            continue
        meta = cache.get(w["key"], {})
        canon = (meta.get("doi") or meta.get("pmcid") or meta.get("pmid")) if w["kind"] == "paper" else None
        groups[canon or w["key"]].append(w)
    todo = []
    for members in groups.values():
        done = next((items[w["key"]] for w in members if items.get(w["key"], {}).get("file")
                     and os.path.exists(os.path.join(LIB, items[w["key"]]["file"]))), None)
        if done:
            for w in members:
                items.setdefault(w["key"], done)
        else:
            todo.append(members)
    print(f"{len(todo)} to fetch")
    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(4) as pool:
        jobs = {pool.submit(fetch_one, members[0], cache): members for members in todo}
        for job in as_completed(jobs):
            members = jobs[job]
            try:
                item = job.result()
            except Exception as e:  # one broken source must not stop the run
                item = {"file": None, "reason": f"{type(e).__name__}: {e}"}
            if item.get("file") and not item.get("files"):
                item["file"], item["sha256"] = dedupe(item["file"], items)
            for w in members:
                items[w["key"]] = item
            key = members[0]["key"]
            print(("  ok " if item.get("file") else "  -  ") + key + ("" if item.get("file") else f": {item['reason']}"),
                  flush=True)
            json.dump(state, open(state_path, "w"), indent=1)
    json.dump(state, open(state_path, "w"), indent=1)


def fetch_one(w, cache):
    meta = cache.get(w["key"], {})
    try:
        if w["kind"] == "thesis" and not meta:
            cache[w["key"]] = meta = dspace_meta(w.get("item"), None if w.get("item") else w["key"].split(":")[1])
        urls = candidates(w, meta)
    except Refused as e:
        return {"file": None, "reason": str(e)}
    except (KeyError, ValueError, IndexError):
        urls = []
    if w["kind"] == "archive" and len(urls) > 1:
        return fetch_archive_item(w, urls)
    rel = os.path.join(FOLDER[w["kind"]], file_name(w, meta))
    url, reason = download(urls, os.path.join(LIB, rel)) if urls else (None, "no open copy found")
    if not url and meta.get("pmcid"):
        # Author manuscripts and older PMC articles: the bucket holds the full text, not a PDF.
        txt = [u for u in pmc_files(meta["pmcid"]) if u.endswith(".txt")]
        if txt:
            status, _, body, _ = get(txt[-1], "text/plain")
            if status == 200 and body:
                rel = rel[:-4] + ".txt"
                with open(os.path.join(LIB, rel), "wb") as fh:
                    fh.write(body)
                return {"file": rel, "from": txt[-1], "reason": "full text only (PMC has no PDF of it)"}
    return {"file": rel if url else None, "from": url, "reason": reason}


def pmc_files(pmcid):
    """The files of the latest version of a PMC article in the pmc-oa-opendata bucket."""
    base = "https://pmc-oa-opendata.s3.amazonaws.com/"
    try:
        status, _, body, _ = get(f"{base}?list-type=2&prefix={pmcid}.&max-keys=200", "application/xml")
    except Refused:
        return []
    keys = re.findall(r"<Key>([^<]+)</Key>", body.decode()) if status == 200 else []
    versions = sorted({k.split("/")[0] for k in keys}, key=lambda v: int(v.rsplit(".", 1)[1]))
    return [base + k for k in keys if versions and k.startswith(versions[-1] + "/")]


def sha256(path):
    import hashlib
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def dedupe(rel, items):
    """The same file reached through two links (an item and its file, a DOI and a PMID): keep one copy.
    Returns (file, sha256)."""
    digest = sha256(os.path.join(LIB, rel))
    for other in items.values():
        f = other.get("file")
        if f and f != rel and other.get("sha256") == digest and os.path.exists(os.path.join(LIB, f)):
            os.remove(os.path.join(LIB, rel))
            return f, digest
    return rel, digest


def fetch_archive_item(w, urls):
    """An Internet Archive item with several PDFs (a collection): all of them, into a folder of its own."""
    folder = os.path.join("archive", slug(w["item"], 80))
    got, reasons = [], []
    for u in urls:
        name = slug(os.path.splitext(urllib.parse.unquote(u.rsplit("/", 1)[1]))[0], 110) + ".pdf"
        if os.path.exists(os.path.join(LIB, folder, name)):
            got.append(name)
            continue
        url, reason = download([u], os.path.join(LIB, folder, name))
        (got if url else reasons).append(name if url else f"{name}: {reason}")
    return {"file": folder if got else None, "from": f"https://archive.org/details/{w['item']}", "files": got,
            "reason": f"{len(urls) - len(got)} of {len(urls)} not downloaded: " + "; ".join(reasons) if reasons else None}


PUBLISHER = {"10.2466": "SAGE (Perceptual and Motor Skills, Psychological Reports)", "10.1177": "SAGE",
             "10.3109": "Taylor & Francis", "10.1080": "Taylor & Francis", "10.1016": "Elsevier (ScienceDirect)",
             "10.1006": "Elsevier (ScienceDirect)", "10.1007": "Springer", "10.1002": "Wiley", "10.1111": "Wiley",
             "10.1046": "Wiley", "10.1038": "Springer Nature", "10.1093": "Oxford University Press",
             "10.1037": "American Psychological Association", "10.1097": "Wolters Kluwer", "10.1089": "Mary Ann Liebert",
             "10.1126": "AAAS (Science)", "10.1056": "NEJM", "10.1212": "Neurology (Wolters Kluwer)",
             "10.1136": "BMJ", "10.1017": "Cambridge University Press", "10.1163": "Brill", "10.3200": "Taylor & Francis"}

ROUTES_PAPER = ("Log in with your edu-ID; \"Online access\" opens the publisher's PDF where "
                "your library licenses the journal (remotely for university members, on library computers or Wi-Fi "
                "for private users); otherwise order a copy with document delivery (paid). Or ask an author for a "
                "copy (ResearchGate \"Request full-text\" or the corresponding author's e-mail), or buy the article "
                "from the publisher")

# swisscovery view for the links in ACCESS.md: the whole network by default, or your library's view
# (SWISSCOVERY_VID=41SLSP_XXX:VU1_UNION, from the address bar of your library's swisscovery page).
SWISSCOVERY_VID = os.environ.get("SWISSCOVERY_VID", "41SLSP_NETWORK:VU1_UNION")


def swisscovery(query):
    return ("https://swisscovery.slsp.ch/discovery/search?query=any,contains,"
            f"{urllib.parse.quote(query)}&vid={urllib.parse.quote(SWISSCOVERY_VID)}")


def access_hint(w, meta, item):
    reason = (item or {}).get("reason") or "not fetched yet"
    k = w["kind"]
    if k == "paper":
        doi = meta.get("doi") or (w["key"][4:] if w["key"].startswith("doi:") else "")
        pub = PUBLISHER.get(doi.split("/")[0], meta.get("publisher") or meta.get("journal") or "the publisher")
        if meta.get("oa") or meta.get("pmcid"):
            return reason, f"Open access, but the download was refused: open https://doi.org/{doi} or " \
                           f"https://europepmc.org/article/PMC/{meta.get('pmcid')} in a browser and save the PDF"
        where = f"[swisscovery]({swisscovery(doi or meta.get('title') or '')})"
        return reason, f"Paywalled ({pub}): {where}, see \"Paywalled papers\" at the top"
    if k == "cia":
        return reason, f"Public: open https://www.cia.gov/readingroom/document/{w['key'].lower()} in a browser and " \
                       f"press \"Download\" (the Reading Room answers scripts with a bot check). Mirrors: " \
                       f"theblackvault.com, archive.org"
    if k == "nap":
        return reason, f"Free PDF: open https://nap.nationalacademies.org/catalog/{w['record']} in a browser, " \
                       f"\"Download Free PDF\", continue as guest"
    if k == "archive" and "borrow" in reason:
        return reason, f"Borrow it free with an archive.org account: https://archive.org/details/{w['item']}"
    if k == "patent":
        return reason, f"Free: {w['page']} → \"Download PDF\""
    if k == "thesis":
        return reason, "Free in Laurentian's repository: open the link and download the PDF in a browser"
    return reason, "Open the link in a browser; if it is a web page, not a PDF, print it to PDF"


def report(works):
    state = json.load(open(os.path.join(LIB, "index.json")))
    cache, items = state["meta"], state["items"]
    add_searches(works, state, refresh=False)
    # Copies filed by hand (library/filed.json: {"pmid:123": "scribd/....pdf"}) count as downloaded.
    filed_path = os.path.join(LIB, "filed.json")
    filed = json.load(open(filed_path)) if os.path.exists(filed_path) else {}
    for key, f in filed.items():
        if f.startswith("scribd:"):  # by Scribd document number, whatever the file is called
            hits = [n for n in os.listdir(os.path.join(LIB, "scribd")) if n.endswith(f"[scribd {f[7:]}].pdf")]
            f = "scribd/" + hits[0] if hits else f
        if not (items.get(key) or {}).get("file") and os.path.exists(os.path.join(LIB, f)):
            items[key] = {"file": f, "from": "filed by hand", "reason": None}
    have, missing = collections.defaultdict(list), []
    seen = set()
    for w in sorted(works.values(), key=lambda w: (w["kind"], w["key"])):
        if w["kind"] == "web":
            continue
        meta, item = cache.get(w["key"], {}), items.get(w["key"])
        title = meta.get("title") or (w["labels"][0] if w["labels"] else w["key"])
        who = (meta.get("authors") or "").split(",")[0].strip()
        bits = [b for b in (who + (" et al." if "," in (meta.get("authors") or "") else ""), meta.get("year"),
                            meta.get("journal")) if b]
        if bits:
            title = f"{title} ({', '.join(bits)})"
        cited = ", ".join(w["cited_in"][:3]) + (f" and {len(w['cited_in']) - 3} more" if len(w["cited_in"]) > 3 else "")
        if item and item.get("file"):
            if item["file"] not in seen:
                seen.add(item["file"])
                have[os.path.dirname(item["file"])].append(f"- [{title}]({urllib.parse.quote(item['file'])}) "
                                                           f"— {w['key']}; cited in {cited}")
        else:
            reason, how = access_hint(w, meta, item)
            missing.append((w["kind"], title, w, reason, how, cited))
    n = sum(len(v) for v in have.values())
    with open(os.path.join(LIB, "INDEX.md"), "w") as fh:
        fh.write(f"# Library\n\n{n} documents downloaded by tools/fetch_sources.py. Not in git: most are copyrighted.\n")
        for folder in sorted(have):
            fh.write(f"\n## {folder}\n\n" + "\n".join(sorted(have[folder])) + "\n")
        hand = sorted(f for f in os.listdir(os.path.join(LIB, "scribd")) if f.endswith(".pdf")) \
            if os.path.isdir(os.path.join(LIB, "scribd")) else []
        if hand:
            fh.write(f"\n## scribd: downloaded by hand ({len(hand)})\n\n" + "\n".join(
                f"- [{os.path.splitext(f)[0]}]({urllib.parse.quote('scribd/' + f)})" for f in hand) + "\n")
    with open(os.path.join(LIB, "ACCESS.md"), "w") as fh:
        fh.write(f"# Not downloaded: how to get them\n\n{len(missing)} sources.\n\n"
                 f"**Paywalled papers.** Each one links to swisscovery. {ROUTES_PAPER}. Save what you get to "
                 f"~/Downloads and say so: it is filed in library/ and listed in library/filed.json.\n")
        searched = lambda m: all(f.startswith("PubMed: ") for f in m[2]["cited_in"])
        groups = [("Papers cited in the project", [m for m in missing if m[0] == "paper" and not searched(m)]),
                  ("Papers from the PubMed searches only (" + ", ".join(SEARCHES) + ")",
                   sorted([m for m in missing if m[0] == "paper" and searched(m)],
                          key=lambda m: cache.get(m[2]["key"], {}).get("year") or ""))]
        names = {"cia": "CIA and NSA documents", "thesis": "Theses", "nap": "National Academies reports",
                 "archive": "Internet Archive items", "patent": "Patents", "pdf": "PDF links",
                 "page": "Journal and repository pages"}
        groups += [(names[k], [m for m in missing if m[0] == k]) for k in names]
        for heading, rows in groups:
            if rows:
                fh.write(f"\n## {heading} ({len(rows)})\n\n")
                for _, title, w, reason, how, cited in rows:
                    link = w["urls"][0] if w["urls"] else ""
                    fh.write(f"- **{title}** — {w['key']} {link}\n  - Why: {reason}\n  - Access: {how}\n"
                             f"  - Cited in: {cited}\n")
    print(f"{n} downloaded (library/INDEX.md), {len(missing)} not (library/ACCESS.md)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["list", "fetch", "report"])
    ap.add_argument("--only", choices=sorted(FOLDER))
    a = ap.parse_args()
    os.makedirs(LIB, exist_ok=True)
    works = collect()
    json.dump(list(works.values()), open(os.path.join(LIB, "sources.json"), "w"), indent=1)
    if a.command == "list":
        kinds = collections.Counter(w["kind"] for w in works.values())
        for k, n in kinds.most_common():
            print(f"{k:8} {n}")
        print(f"\n{len(works)} sources cited in {len({f for w in works.values() for f in w['cited_in']})} files; "
              f"written to library/sources.json")
    elif a.command == "fetch":
        fetch(works, a.only)
    else:
        report(works)


if __name__ == "__main__":
    sys.exit(main())
