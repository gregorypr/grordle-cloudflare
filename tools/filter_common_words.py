from wordfreq import word_frequency
import sys

# Read the word list
with open('filtered-wordlist.txt', 'r') as f:
    words = [line.strip() for line in f if line.strip()]

print(f"Total words: {len(words)}")

# Get word frequencies (wordfreq uses lowercase)
word_freq_pairs = []
for word in words:
    freq = word_frequency(word.lower(), 'en')
    word_freq_pairs.append((word, freq))

# Sort by frequency (most common first)
word_freq_pairs.sort(key=lambda x: x[1], reverse=True)

# Let's see the distribution
print("\nMost common words:")
for word, freq in word_freq_pairs[:10]:
    print(f"  {word}: {freq:.2e}")

print("\nLeast common words:")
for word, freq in word_freq_pairs[-10:]:
    print(f"  {word}: {freq:.2e}")

# Filter by frequency threshold
# wordfreq uses a log scale where:
# - 1e-3 (0.001) = very common words
# - 1e-6 (0.000001) = uncommon but known words
# - 1e-7 and below = very rare/obscure words

# Let's try different thresholds and see the counts
thresholds = [1e-5, 1e-6, 1e-7, 1e-8]
print("\nWords at different frequency thresholds:")
for threshold in thresholds:
    count = sum(1 for _, freq in word_freq_pairs if freq >= threshold)
    print(f"  >= {threshold:.0e}: {count} words")

# Use a reasonable threshold (1e-7 includes less common but known words)
THRESHOLD = 1e-7
common_words = [word for word, freq in word_freq_pairs if freq >= THRESHOLD]

print(f"\nFiltering with threshold {THRESHOLD:.0e}")
print(f"Kept: {len(common_words)} words")
print(f"Removed: {len(words) - len(common_words)} words")

# Save the filtered list (sorted by frequency)
with open('common-wordlist.txt', 'w') as f:
    f.write('\n'.join(common_words))

print("\nFiltered word list saved to common-wordlist.txt")

# Also save a version with frequencies for review
with open('wordlist-with-frequencies.txt', 'w') as f:
    for word, freq in word_freq_pairs:
        if freq >= THRESHOLD:
            f.write(f"{word}\t{freq:.2e}\n")

print("Word list with frequencies saved to wordlist-with-frequencies.txt")
