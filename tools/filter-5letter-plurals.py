#!/usr/bin/env python3
"""Remove likely plurals from a 5-letter word list."""

import sys

def is_likely_plural(word):
    """Check if a 5-letter word is likely a plural."""
    word_lower = word.lower()
    
    # Keep words ending in double-s (bliss, glass, brass, etc)
    if word_lower.endswith('ss'):
        return False
    
    # Keep specific non-plural -us words (genus, bonus, virus, etc)
    if word_lower.endswith('us') and word_lower in ['bonus', 'genus', 'humus', 'mucus', 'nexus', 'sinus', 'virus', 'bogus', 'focus', 'locus', 'mucus', 'status', 'cactus', 'lotus']:
        return False
        
    # Remove words ending in -ies (likely plural of -y words: stories, cities)
    if word_lower.endswith('ies'):
        return True
    
    # Remove words ending in -ves (likely plural of -f/-fe words: knives, wives)
    if word_lower.endswith('ves'):
        return True
        
    # Remove words ending in -ses (cases, bases, roses, etc)
    if word_lower.endswith('ses'):
        return True
    
    # Remove words ending in -xes (boxes, taxes - though these are 5+ letters)
    if word_lower.endswith('xes'):
        return True
    
    # Remove common plural patterns ending in consonant + s
    if word_lower.endswith('s') and len(word_lower) == 5:
        second_last = word_lower[-2]
        third_last = word_lower[-3] if len(word_lower) > 2 else ''
        
        # Consonant + s endings (cats, dogs, etc)
        if second_last in 'tdkpngfcblrm':
            # But keep some valid words like "basis", "oasis" - wait, those don't match this pattern
            return True
            
        # Common -es plurals: -les (rules, miles), -res (fires, tires), -tes (votes, notes), -nes (tones, zones)
        if second_last in 'lrtn' and third_last == 'e':
            return False  # Actually these might be valid base words
            
        # -as endings (areas, ideas - these are typically plurals)
        if word_lower.endswith('as'):
            # But keep valid singular words
            if word_lower in ['atlas', 'texas', 'areas', 'ideas', 'canvas']:
                # Actually areas and ideas ARE plurals, let's remove them
                if word_lower not in ['atlas', 'texas', 'canvas', 'judas']:
                    return True
        
    return False

def main():
    if len(sys.argv) != 3:
        print("Usage: filter-5letter-plurals.py input.txt output.txt")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]
    
    # Check if first line is a header
    has_header = lines[0].startswith('WORD')
    if has_header:
        header = lines[0]
        lines = lines[1:]
    else:
        header = None
    
    kept = []
    removed = []
    
    for line in lines:
        # Extract just the word (first column, tab-separated)
        parts = line.split('\t')
        word = parts[0] if parts else line
        
        if is_likely_plural(word):
            removed.append(word)
        else:
            kept.append(line)  # Keep the full line with all data
    
    with open(output_file, 'w', encoding='utf-8') as f:
        if header:
            f.write(header + '\n')
        f.write('\n'.join(kept) + '\n')
    
    print(f"Input words: {len(lines)}")
    print(f"Kept: {len(kept)}")
    print(f"Removed: {len(removed)}")
    print(f"Sample removed: {', '.join(removed[:20])}")

if __name__ == '__main__':
    main()
