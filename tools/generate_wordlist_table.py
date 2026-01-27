#!/usr/bin/env python3

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from wordfreq import zipf_frequency


SCRABBLE_POINTS: dict[str, int] = {
    "a": 1,
    "b": 3,
    "c": 3,
    "d": 2,
    "e": 1,
    "f": 4,
    "g": 2,
    "h": 4,
    "i": 1,
    "j": 8,
    "k": 5,
    "l": 1,
    "m": 3,
    "n": 1,
    "o": 1,
    "p": 3,
    "q": 10,
    "r": 1,
    "s": 1,
    "t": 1,
    "u": 1,
    "v": 4,
    "w": 4,
    "x": 8,
    "y": 4,
    "z": 10,
}


@dataclass(frozen=True)
class WordRow:
    word: str  # lowercase
    zipf: float
    scrabble: int


def scrabble_score(word: str) -> int:
    total = 0
    for ch in word:
        total += SCRABBLE_POINTS.get(ch, 0)
    return total


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def normalize(value: float, *, min_value: float, max_value: float) -> float:
    if max_value <= min_value:
        return 0.0
    return clamp01((value - min_value) / (max_value - min_value))


def format_float(value: float) -> str:
    # Matches existing file style like "8.4" rather than "8.40".
    s = f"{value:.2f}"
    s = s.rstrip("0").rstrip(".")
    return s


def load_words(path: Path) -> list[str]:
    words: list[str] = []
    seen: set[str] = set()

    for raw in path.read_text(encoding="utf-8").splitlines():
        w = raw.strip().lower()
        if not w:
            continue
        if len(w) != 5:
            continue
        if not w.isalpha():
            continue
        if w in seen:
            continue
        seen.add(w)
        words.append(w)

    return words


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a tab-delimited wordlist-table file: WORD, DIFFICULTY, SCRABBLE_SCORE, PAR. "
            "Difficulty = weighted combination of word commonality (Zipf frequency rank) and scrabble score."
        )
    )
    parser.add_argument("input", type=Path, help="Input word list (one word per line)")
    parser.add_argument("output", type=Path, help="Output TSV file")
    parser.add_argument(
        "--weight-commonality",
        type=float,
        default=0.8,
        help="Weight for commonality component (default 0.8)",
    )
    parser.add_argument(
        "--weight-scrabble",
        type=float,
        default=0.2,
        help="Weight for scrabble component (default 0.2)",
    )
    parser.add_argument(
        "--easy-percent",
        type=float,
        default=0.20,
        help="Fraction of words assigned PAR 3 (default 0.20)",
    )
    parser.add_argument(
        "--hard-percent",
        type=float,
        default=0.20,
        help="Fraction of words assigned PAR 5 (default 0.20)",
    )

    args = parser.parse_args()

    if args.weight_commonality < 0 or args.weight_scrabble < 0:
        raise SystemExit("Weights must be non-negative")
    weight_sum = args.weight_commonality + args.weight_scrabble
    if weight_sum <= 0:
        raise SystemExit("At least one weight must be > 0")

    w_common = args.weight_commonality / weight_sum
    w_scrabble = args.weight_scrabble / weight_sum

    words = load_words(args.input)
    if not words:
        raise SystemExit("No valid 5-letter words found in input")

    rows: list[WordRow] = []
    for w in words:
        z = float(zipf_frequency(w, "en"))
        rows.append(WordRow(word=w, zipf=z, scrabble=scrabble_score(w)))

    # Commonality component: rank by zipf descending (more common => easier => lower score).
    rows_by_common = sorted(rows, key=lambda r: (-r.zipf, r.word))
    n = len(rows_by_common)

    commonality_score_by_word: dict[str, float] = {}
    if n == 1:
        commonality_score_by_word[rows_by_common[0].word] = 0.0
    else:
        for idx, r in enumerate(rows_by_common):
            percentile = idx / (n - 1)  # 0..1 (0 easiest)
            commonality_score_by_word[r.word] = percentile * 100.0

    scrabble_scores = [r.scrabble for r in rows]
    scr_min = float(min(scrabble_scores))
    scr_max = float(max(scrabble_scores))

    difficulty_by_word: dict[str, float] = {}
    for r in rows:
        common_score = commonality_score_by_word[r.word]
        scr_norm = normalize(float(r.scrabble), min_value=scr_min, max_value=scr_max) * 100.0
        difficulty = w_common * common_score + w_scrabble * scr_norm
        difficulty_by_word[r.word] = difficulty

    # Assign PAR buckets by difficulty (lower = easier): 20% PAR 3, middle 60% PAR 4, 20% PAR 5.
    rows_by_diff = sorted(rows, key=lambda r: (difficulty_by_word[r.word], r.word))

    easy_count = int(n * args.easy_percent)
    hard_count = int(n * args.hard_percent)
    if easy_count < 0:
        easy_count = 0
    if hard_count < 0:
        hard_count = 0
    if easy_count + hard_count > n:
        # Clamp in a predictable way.
        hard_count = max(0, n - easy_count)

    par_by_word: dict[str, int] = {}
    hard_start = n - hard_count

    for idx, r in enumerate(rows_by_diff):
        if idx < easy_count:
            par_by_word[r.word] = 3
        elif idx >= hard_start:
            par_by_word[r.word] = 5
        else:
            par_by_word[r.word] = 4

    # Emit rows in commonality order (most common first), matching the existing file's intent.
    out_lines: list[str] = ["WORD\tDIFFICULTY\tSCRABBLE_SCORE\tPAR"]
    for r in rows_by_common:
        out_lines.append(
            "\t".join(
                [
                    r.word.upper(),
                    format_float(difficulty_by_word[r.word]),
                    str(r.scrabble),
                    str(par_by_word[r.word]),
                ]
            )
        )

    args.output.write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    # Summary
    par3 = sum(1 for v in par_by_word.values() if v == 3)
    par4 = sum(1 for v in par_by_word.values() if v == 4)
    par5 = sum(1 for v in par_by_word.values() if v == 5)
    print(f"Words: {n}")
    print(f"Scrabble score range: {int(scr_min)}..{int(scr_max)}")
    print(f"Weights: commonality={w_common:.2f}, scrabble={w_scrabble:.2f}")
    print(f"PAR distribution: 3={par3}, 4={par4}, 5={par5}")
    print(f"Wrote: {args.output}")


if __name__ == "__main__":
    main()
