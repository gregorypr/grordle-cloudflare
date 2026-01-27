#!/usr/bin/env python3

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from wordfreq import zipf_frequency


@dataclass(frozen=True)
class Stats:
    total_in: int
    kept: int
    removed_ed: int
    removed_plural_s: int
    blank_lines: int
    duplicates_removed: int
def min_zipf_for_len(length: int, *, min_zipf_3: float, min_zipf_4: float, min_zipf_5: float) -> float:
    if length <= 3:
        return min_zipf_3
    if length == 4:
        return min_zipf_4
    return min_zipf_5


def is_likely_real_word(
    word: str,
    *,
    min_zipf_3: float,
    min_zipf_4: float,
    min_zipf_5: float,
) -> bool:
    threshold = min_zipf_for_len(len(word), min_zipf_3=min_zipf_3, min_zipf_4=min_zipf_4, min_zipf_5=min_zipf_5)
    return zipf_frequency(word, "en") >= threshold


def plural_base_candidates(word: str) -> list[str]:
    if word.endswith(("ss", "us", "is", "os")):
        return []

    if word.endswith("ies") and len(word) > 3:
        return [word[:-3] + "y"]

    if word.endswith("ves") and len(word) > 3:
        return [word[:-3] + "fe", word[:-3] + "f"]

    if word.endswith("es") and len(word) > 2:
        return [word[:-2]]

    if word.endswith("s") and len(word) > 1:
        return [word[:-1]]

    return []


def past_tense_base_candidates(word: str) -> list[str]:
    # dried -> dry
    if word.endswith("ied") and len(word) > 3:
        return [word[:-3] + "y"]

    if word.endswith("ed") and len(word) > 2:
        # Try base+'d' first (urge -> urged, race -> raced), then base+'ed' (fix -> fixed).
        return [word[:-1], word[:-2]]

    return []


def filter_words(
    lines: list[str],
    *,
    min_zipf_3: float,
    min_zipf_4: float,
    min_zipf_5: float,
) -> tuple[list[str], Stats]:
    kept: list[str] = []
    seen: set[str] = set()
    removed_ed = 0
    removed_plural_s = 0
    blank_lines = 0
    duplicates_removed = 0

    for raw in lines:
        w = raw.strip().lower()
        if not w:
            blank_lines += 1
            continue

        if w.endswith("ed"):
            candidates = past_tense_base_candidates(w)
            if any(
                is_likely_real_word(c, min_zipf_3=min_zipf_3, min_zipf_4=min_zipf_4, min_zipf_5=min_zipf_5)
                for c in candidates
            ):
                removed_ed += 1
                continue

        if w.endswith("s"):
            candidates = plural_base_candidates(w)
            if any(
                is_likely_real_word(c, min_zipf_3=min_zipf_3, min_zipf_4=min_zipf_4, min_zipf_5=min_zipf_5)
                for c in candidates
            ):
                removed_plural_s += 1
                continue

        if w in seen:
            duplicates_removed += 1
            continue
        seen.add(w)
        kept.append(w)

    stats = Stats(
        total_in=len(lines),
        kept=len(kept),
        removed_ed=removed_ed,
        removed_plural_s=removed_plural_s,
        blank_lines=blank_lines,
        duplicates_removed=duplicates_removed,
    )
    return kept, stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Filter a word list to remove -ed words and likely plurals ending in 's'."
    )
    parser.add_argument("input", type=Path, help="Input word list (one word per line)")
    parser.add_argument("output", type=Path, help="Output filtered word list")
    parser.add_argument(
        "--min-zipf-3",
        type=float,
        default=4.0,
        help="Zipf threshold for 3-letter base candidates (default: 4.0)",
    )
    parser.add_argument(
        "--min-zipf-4",
        type=float,
        default=3.8,
        help="Zipf threshold for 4-letter base candidates (default: 3.8)",
    )
    parser.add_argument(
        "--min-zipf-5",
        type=float,
        default=2.0,
        help="Zipf threshold for 5+ letter base candidates (default: 2.0)",
    )
    args = parser.parse_args()

    lines = args.input.read_text(encoding="utf-8").splitlines()
    kept, stats = filter_words(
        lines,
        min_zipf_3=args.min_zipf_3,
        min_zipf_4=args.min_zipf_4,
        min_zipf_5=args.min_zipf_5,
    )

    args.output.write_text("\n".join(kept) + "\n", encoding="utf-8")

    removed_total = stats.removed_ed + stats.removed_plural_s
    print(f"Input lines:      {stats.total_in}")
    print(f"Blank lines:      {stats.blank_lines}")
    print(f"Removed (*ed):    {stats.removed_ed}")
    print(f"Removed (*s):     {stats.removed_plural_s}")
    print(f"Removed total:    {removed_total}")
    print(f"Kept:             {stats.kept}")
    print(f"De-duped:         {stats.duplicates_removed}")
    print(f"Output file:      {args.output}")


if __name__ == "__main__":
    main()
