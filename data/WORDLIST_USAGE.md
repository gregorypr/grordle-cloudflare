# Wordlist Database Usage Guide

The game now uses a database-backed wordlist system with difficulty ratings and PAR scoring.

## Setup

### 1. Populate the Database

First, make sure you have the wordlist data file, then run:

```bash
node tools/populate-wordlist-db.js
```

This will:
- Load 3000 words from `common-wordlist-top3000-with-par.txt`
- Insert them into the `wordlist` table
- Create indexes for fast queries
- Display PAR distribution statistics

### 2. Database Schema

The `wordlist` table contains:
- `word` (VARCHAR(5)) - The 5-letter word
- `difficulty` (DECIMAL) - Difficulty score 0-100 (lower = easier)
- `scrabble_score` (INTEGER) - Scrabble point value
- `par` (INTEGER) - Golf-style par rating: 3 (easy), 4 (medium), 5 (hard)

## Allocating Words for Games

### Using the Wordlist Database (Recommended)

Allocate random words from the wordlist:

```bash
POST /api/allocate-start-words
{
  "startDate": "2025-01-01",
  "daysToAllocate": 30
}
```

**Filter by PAR difficulty:**

```bash
POST /api/allocate-start-words
{
  "startDate": "2025-01-01",
  "daysToAllocate": 30,
  "par": 3  // Only allocate PAR 3 (easy) words
}
```

Available PAR values:
- `3` - Easy words (top 20% by difficulty)
- `4` - Medium words (middle 60%)
- `5` - Hard words (bottom 20%)

### Using Member Words (Legacy Mode)

To use the old member-based word selection:

```bash
POST /api/allocate-start-words
{
  "startDate": "2025-01-01",
  "daysToAllocate": 30,
  "useMemberWords": true
}
```

## Querying the Wordlist

### Get Words by PAR

```bash
GET /api/wordlist?par=3&limit=20
```

### Get Random Word

```bash
GET /api/wordlist?random=true&limit=1
```

### Get Specific Word Details

```bash
GET /api/wordlist?word=ABOUT
```

### Get Multiple Words

```bash
POST /api/wordlist
{
  "words": ["ABOUT", "THEIR", "THERE"]
}
```

## Game Start Response

When a player starts a game, the response now includes word metadata:

```json
{
  "allowed": true,
  "dailyPlayers": ["Player1", "Player2"],
  "startWord": "ABOUT",
  "startWordOwner": null,
  "wordDifficulty": 8.4,
  "wordScrabbleScore": 7,
  "wordPar": 3
}
```

- `wordDifficulty` - 0-100 score (lower = easier)
- `wordScrabbleScore` - Scrabble points
- `wordPar` - Expected number of attempts (3, 4, or 5)
- `startWordOwner` - Member name (only when using legacy member words)

## PAR Distribution

The 3000 words are distributed as:
- **PAR 3** (Easy): 600 words (20%)
  - Common words with simple letters
  - Examples: ABOUT, THEIR, THERE
  
- **PAR 4** (Medium): 1800 words (60%)
  - Moderately common words
  - Examples: RINGS, SPOTS, ROBIN
  
- **PAR 5** (Hard): 600 words (20%)
  - Less common words or complex letter combinations
  - Examples: NATTY, RISHI, SHREW

## Difficulty Calculation

Difficulty is calculated using:
- **80%** - Word position/commonality (earlier in list = more common = easier)
- **20%** - Scrabble score (higher letter values = harder)

## Tips

1. **Weekly Easy Days**: Allocate PAR 3 words for Mondays
2. **Challenge Days**: Use PAR 5 words for Fridays
3. **Mixed Difficulty**: Don't specify PAR to get random mix
4. **Preview Words**: Use the `/api/wordlist` endpoint to see available words before allocating
