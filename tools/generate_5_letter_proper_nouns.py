#!/usr/bin/env python3
"""Generate a comprehensive list of 5-letter English proper nouns (people, places, brands, fictional characters).

Data sources:
- Wikidata Query Service (WDQS): https://query.wikidata.org/  (SPARQL endpoint supports CSV/JSON)
- GeoNames dump: https://download.geonames.org/export/dump/

This script:
1) Queries Wikidata categories in pages (LIMIT/OFFSET), pulls English labels, filters to ^[A-Za-z]{5}$.
2) Optionally downloads GeoNames cities500.zip (smaller) or allCountries.zip (huge) and extracts 5-letter ASCII names.
3) Writes:
   - proper_nouns_5_letters.txt (unique terms)
   - proper_nouns_5_letters_with_category.tsv (term<TAB>category)

You can run this locally; it does live HTTP requests.
"""

import csv
import io
import os
import re
import sys
import time
import zipfile
from dataclasses import dataclass
from typing import Dict, Iterable, Set
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import URLError

ASCII5 = re.compile(r"^[A-Za-z]{5}$")

WDQS_ENDPOINT = "https://query.wikidata.org/sparql?format=csv&query="

# Tune these
LIMIT = 10000
PAGE_COUNT = 8       # up to 80k rows per category (stops early if a page is empty)
SLEEP_SECONDS = 1.5  # be nice to WDQS - increased to reduce throttling
MAX_RETRIES = 3      # retry failed requests
TIMEOUT_SECONDS = 120  # increased timeout for slow connections

# Choose GeoNames source: cities500.zip is ~185k places; allCountries.zip is huge
GEONAMES_URL = "https://download.geonames.org/export/dump/cities500.zip"
# GEONAMES_URL = "https://download.geonames.org/export/dump/allCountries.zip"  # huge

OUT_TXT = "proper_nouns_5_letters.txt"
OUT_TSV = "proper_nouns_5_letters_with_category.tsv"

USER_AGENT = "five-letter-proper-nouns-generator/1.0 (local script)"


@dataclass(frozen=True)
class Category:
    name: str
    qid: str  # Wikidata Q-id


CATEGORIES = [
    Category("person", "Q5"),                  # human
    Category("place", "Q486972"),              # human settlement (broad); swap to Q515 for city
    Category("brand", "Q431289"),              # brand
    Category("fictional_character", "Q95074"), # fictional character
]


def wdqs_query_labels_of_class(qid: str, limit: int, offset: int) -> str:
    return f"""
SELECT ?label WHERE {{
  ?item wdt:P31/wdt:P279* wd:{qid} .
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = \"en\") .
  FILTER(REGEX(?label, \"^[A-Za-z]{{5}}$\")) .
}}
LIMIT {limit}
OFFSET {offset}
""".strip()


def http_get(url: str, retries: int = MAX_RETRIES) -> bytes:
    """Fetch URL with retry logic for timeout errors."""
    last_error = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/csv"})
            with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                return resp.read()
        except TimeoutError as e:
            last_error = e
            wait_time = (attempt + 1) * 2  # exponential backoff: 2s, 4s, 6s
            print(f"Timeout error (attempt {attempt + 1}/{retries}), retrying in {wait_time}s...", file=sys.stderr)
            time.sleep(wait_time)
        except URLError as e:
            last_error = e
            if attempt < retries - 1:
                wait_time = (attempt + 1) * 2
                print(f"URL error (attempt {attempt + 1}/{retries}): {e}, retrying in {wait_time}s...", file=sys.stderr)
                time.sleep(wait_time)
            else:
                raise
    raise last_error or RuntimeError("Failed to fetch URL after retries")


def fetch_wikidata_category(cat: Category) -> Set[str]:
    results: Set[str] = set()
    for page in range(PAGE_COUNT):
        offset = page * LIMIT
        sparql = wdqs_query_labels_of_class(cat.qid, LIMIT, offset)
        url = WDQS_ENDPOINT + quote(sparql)
        
        print(f"  Page {page + 1}/{PAGE_COUNT} (offset {offset})...", file=sys.stderr)
        try:
            data = http_get(url)
        except Exception as e:
            print(f"  Failed to fetch page {page + 1}: {e}", file=sys.stderr)
            print(f"  Continuing with data collected so far ({len(results)} items)...", file=sys.stderr)
            break

        text = data.decode("utf-8", errors="replace")
        rows = list(csv.DictReader(io.StringIO(text)))
        if not rows:
            print(f"  No more results at offset {offset}, stopping early.", file=sys.stderr)
            break

        for r in rows:
            label = (r.get("label") or "").strip()
            if ASCII5.match(label):
                results.add(label)

        print(f"  Found {len(results)} unique 5-letter names so far.", file=sys.stderr)
        time.sleep(SLEEP_SECONDS)

    return results


def download_geonames_zip(url: str, dest: str) -> str:
    print(f"Downloading GeoNames: {url}", file=sys.stderr)
    data = http_get(url)
    with open(dest, "wb") as f:
        f.write(data)
    return dest


def iter_geonames_names(zip_path: str) -> Iterable[str]:
    with zipfile.ZipFile(zip_path) as zf:
        txt_members = [n for n in zf.namelist() if n.lower().endswith(".txt")]
        if not txt_members:
            raise RuntimeError("No .txt found in GeoNames zip")
        member = txt_members[0]

        with zf.open(member) as f:
            for raw in f:
                # GeoNames is tab-separated; name is column 2 (index 1)
                line = raw.decode("utf-8", errors="replace").rstrip("\n")
                cols = line.split("\t")
                if len(cols) > 1:
                    yield cols[1].strip()


def fetch_geonames_places(tmp_dir: str) -> Set[str]:
    os.makedirs(tmp_dir, exist_ok=True)
    zip_path = os.path.join(tmp_dir, os.path.basename(GEONAMES_URL))
    if not os.path.exists(zip_path):
        download_geonames_zip(GEONAMES_URL, zip_path)

    results: Set[str] = set()
    for name in iter_geonames_names(zip_path):
        if ASCII5.match(name):
            results.add(name)
    return results


def write_outputs(items: Dict[str, Set[str]]) -> None:
    all_terms: Set[str] = set().union(*items.values())

    with open(OUT_TXT, "w", encoding="utf-8") as f:
        for t in sorted(all_terms):
            f.write(t + "\n")

    with open(OUT_TSV, "w", encoding="utf-8") as f:
        for cat, terms in items.items():
            for t in sorted(terms):
                f.write(f"{t}\t{cat}\n")


def main() -> int:
    items: Dict[str, Set[str]] = {}

    # Wikidata categories
    for cat in CATEGORIES:
        print(f"Fetching Wikidata: {cat.name} ({cat.qid})", file=sys.stderr)
        items[cat.name] = fetch_wikidata_category(cat)

    # GeoNames supplement for places (optional)
    try:
        items["place_geonames"] = fetch_geonames_places(tmp_dir=".tmp_geonames")
    except Exception as e:
        print(f"GeoNames step skipped/failed: {e}", file=sys.stderr)

    write_outputs(items)

    print(f"Wrote: {OUT_TXT}", file=sys.stderr)
    print(f"Wrote: {OUT_TSV}", file=sys.stderr)
    for k, v in items.items():
        print(f"{k}: {len(v)}", file=sys.stderr)
    print(f"TOTAL unique: {len(set().union(*items.values()))}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
