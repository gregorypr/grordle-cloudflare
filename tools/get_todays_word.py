# Script to calculate today's word for grordle

def get_seed(date_str):
    s = "TARGET:" + date_str
    seed = 0
    for c in s:
        seed = (seed * 31 + ord(c)) & 0xFFFFFFFF
    return seed

# Read wordlist (skip header)
with open("data/wordlist-table.txt", "r") as f:
    lines = f.readlines()[1:]
    words = [line.split("\t")[0] for line in lines]

today = "2026-01-24"
seed = get_seed(today)
index = seed % len(words)
todays_word = words[index]
print(f"Today's word for {today} is: {todays_word}")
