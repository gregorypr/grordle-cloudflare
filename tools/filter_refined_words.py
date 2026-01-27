from wordfreq import word_frequency
import nltk
from nltk.corpus import words as nltk_words
import enchant

# Download required NLTK data
try:
    nltk.data.find('corpora/words')
except LookupError:
    nltk.download('words', quiet=True)

# Read the common word list
with open('common-wordlist.txt', 'r') as f:
    word_list = [line.strip() for line in f if line.strip()]

print(f"Starting with: {len(word_list)} words")

# Initialize enchant dictionary for standard English
d = enchant.Dict("en_US")

# Get NLTK words for reference
nltk_word_set = set(w.upper() for w in nltk_words.words())

# Known proper nouns and place names (common ones in 5-letter format)
PROPER_NOUNS = {
    'JAMES', 'JONES', 'SMITH', 'DAVID', 'MARIA', 'SARAH', 'PETER', 'ALICE',
    'CHINA', 'JAPAN', 'INDIA', 'SPAIN', 'ITALY', 'PARIS', 'TOKYO', 'CAIRO',
    'TEXAS', 'MAINE', 'IDAHO', 'NEPAL', 'CHILE', 'CONGO', 'GHANA', 'HAITI',
    'KENYA', 'LIBYA', 'NIGER', 'SUDAN', 'WALES', 'SYRIA', 'YEMEN', 'BENIN',
    'GABON', 'QATAR', 'SAMOA', 'TONGA', 'MALTA'
}

# Common slang/informal words to remove
SLANG_INFORMAL = {
    'GONNA', 'WANNA', 'GOTTA', 'KINDA', 'SORTA', 'DUNNO', 'LEMME', 'GIMME',
    'AIN\'T', 'YALL', 'NOPE', 'YEAH', 'YIKES', 'DUDES', 'BROS', 'DAWG'
}

filtered_words = []
removed_proper = []
removed_plural = []
removed_slang = []
removed_other = []

# Create a set for quick lookup
word_set = set(word_list)

for word in word_list:
    # Check if it's a known proper noun or place name
    if word in PROPER_NOUNS:
        removed_proper.append(word)
        continue
    
    # Check if it's known slang
    if word in SLANG_INFORMAL:
        removed_slang.append(word)
        continue
    
    # Check for plurals (ends in S and root word exists)
    if word.endswith('S') and len(word) > 1:
        root = word[:-1]
        if root in word_set:
            removed_plural.append(word)
            continue
        # Also check for -ES plurals
        if word.endswith('ES') and len(word) > 2:
            root_es = word[:-2]
            if root_es in word_set:
                removed_plural.append(word)
                continue
    
    # Additional check: if word is not in standard dictionary, might be slang
    # But be careful - some valid words might not be in enchant
    lower_word = word.lower()
    if not d.check(lower_word):
        # Double-check with NLTK corpus
        if word not in nltk_word_set:
            # Check if it's a very rare word (likely slang/informal if freq is low)
            freq = word_frequency(lower_word, 'en')
            if freq < 1e-7:
                removed_other.append(word)
                continue
    
    # Word passed all filters
    filtered_words.append(word)

print(f"\nFiltering results:")
print(f"  Removed proper nouns/places: {len(removed_proper)}")
print(f"  Removed plurals: {len(removed_plural)}")
print(f"  Removed slang/informal: {len(removed_slang)}")
print(f"  Removed other (not in dictionaries): {len(removed_other)}")
print(f"  Total removed: {len(word_list) - len(filtered_words)}")
print(f"  Remaining words: {len(filtered_words)}")

# Show some examples of what was removed
if removed_proper:
    print(f"\nSample proper nouns removed: {', '.join(removed_proper[:10])}")
if removed_plural:
    print(f"Sample plurals removed: {', '.join(removed_plural[:10])}")
if removed_slang:
    print(f"Sample slang removed: {', '.join(removed_slang[:10])}")
if removed_other:
    print(f"Sample other removed: {', '.join(removed_other[:10])}")

# Save the refined list
with open('refined-wordlist.txt', 'w') as f:
    f.write('\n'.join(filtered_words))

print("\nRefined word list saved to refined-wordlist.txt")

# Save removed words for review
with open('removed-words.txt', 'w') as f:
    f.write("=== PROPER NOUNS/PLACES ===\n")
    f.write('\n'.join(removed_proper))
    f.write("\n\n=== PLURALS ===\n")
    f.write('\n'.join(removed_plural))
    f.write("\n\n=== SLANG/INFORMAL ===\n")
    f.write('\n'.join(removed_slang))
    f.write("\n\n=== OTHER (NOT IN DICTIONARIES) ===\n")
    f.write('\n'.join(removed_other))

print("Removed words saved to removed-words.txt for review")
