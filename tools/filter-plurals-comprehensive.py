#!/usr/bin/env python3
"""Comprehensive plural and proper noun filter for 5-letter words."""

import sys
import re

# Proper nouns to exclude (common names, places)
PROPER_NOUNS = {
    'aaron', 'abbey', 'adams', 'agnes', 'aidan', 'aiden', 'aisle', 'aisha', 'akbar',
    'alan', 'alana', 'alarm', 'alas!', 'albania', 'albany', 'albert', 'alden', 'alec',
    'alexa', 'alexis', 'alfred', 'algeria', 'alice', 'allan', 'allen', 'amber',
    'amish', 'andre', 'angel', 'angie', 'anglo', 'anita', 'annie', 'anton', 'april',
    'arab', 'arabic', 'arabs', 'arctic', 'argentina', 'argus', 'ariel', 'aries',
    'aristotle', 'arlen', 'arlington', 'arnie', 'arnold', 'arthur', 'asian', 'asians',
    'assam', 'athens', 'atlas', 'audrey', 'austin', 'austria', 'avery', 'avril',
    'bacon', 'badge', 'bailey', 'baker', 'banks', 'baron', 'barry', 'basil',
    'baton', 'baxter', 'belle', 'benny', 'benton', 'berlin', 'bernie', 'betty',
    'bible', 'biden', 'billy', 'blake', 'bobby', 'boris', 'bosch', 'boston',
    'boxer', 'brady', 'brand', 'brent', 'brett', 'brian', 'brice', 'brick',
    'bruce', 'bruno', 'bryan', 'bryce', 'byron', 'cabot', 'caesar', 'cairo',
    'caleb', 'camel', 'campbell', 'canada', 'canadian', 'canon', 'carey', 'carlo',
    'carlos', 'carmen', 'carol', 'carrie', 'carson', 'carter', 'casey', 'cathy',
    'cecil', 'cedar', 'celtic', 'cesar', 'chad', 'chang', 'chaos', 'charlie',
    'chase', 'chelsea', 'chess', 'chester', 'chicago', 'china', 'chinese', 'chloe',
    'choir', 'christ', 'christian', 'christie', 'chuck', 'clara', 'clark', 'claude',
    'cliff', 'clinton', 'clyde', 'cohen', 'colin', 'comet', 'congo', 'connie',
    'connor', 'conrad', 'cooper', 'copley', 'cora', 'corey', 'costa', 'craig',
    'croat', 'crowe', 'crown', 'crude', 'cruz', 'cuban', 'cubs', 'curry',
    'curtis', 'cyril', 'czech', 'daily', 'dairy', 'daisy', 'dakota', 'dallas',
    'damon', 'danny', 'dante', 'darcy', 'darryl', 'daryl', 'dated', 'davis',
    'dawn', 'deane', 'delhi', 'delta', 'demon', 'denmark', 'dennis', 'denver',
    'derek', 'devon', 'diana', 'diane', 'diego', 'dixie', 'dodge', 'dolly',
    'donna', 'dora', 'doris', 'dorothy', 'doug', 'dover', 'drake', 'drew',
    'duane', 'dublin', 'dudes', 'duke', 'dulles', 'dummy', 'duncan', 'dunne',
    'dutch', 'dwarf', 'dwayne', 'dylan', 'eddie', 'edgar', 'edith', 'edwin',
    'egypt', 'egyptian', 'eiffel', 'elena', 'elias', 'ellen', 'elliot', 'ellis',
    'elton', 'elves', 'emily', 'emma', 'enoch', 'enron', 'eric', 'erica',
    'ericsson', 'erik', 'ernst', 'essex', 'estonia', 'ethan', 'ethnic', 'euclid',
    'euler', 'euros', 'evans', 'fairy', 'faith', 'fargo', 'felix', 'ferris',
    'finns', 'fiona', 'fisher', 'flame', 'floyd', 'flynn', 'foster', 'franc',
    'france', 'francis', 'franco', 'frank', 'franz', 'fraser', 'frazier', 'french',
    'freud', 'fritz', 'gable', 'gail', 'galileo', 'galway', 'gamma', 'gandhi',
    'garbo', 'garcia', 'gates', 'gavin', 'gemini', 'gene', 'genesis', 'geneva',
    'genoa', 'george', 'georgia', 'german', 'germans', 'germany', 'gerry', 'ghana',
    'ghost', 'giant', 'giants', 'gibson', 'giles', 'gina', 'glenn', 'gloria',
    'goats', 'godfrey', 'goethe', 'golan', 'golda', 'gomez', 'gordon', 'gospel',
    'goths', 'gothic', 'grace', 'grady', 'graham', 'grant', 'graves', 'greece',
    'greek', 'greeks', 'green', 'greene', 'gregory', 'greta', 'griffin', 'grimm',
    'grimes', 'haiti', 'haitian', 'hamas', 'hardy', 'harlem', 'harper', 'harriet',
    'harris', 'harry', 'harvey', 'hatch', 'haven', 'hayes', 'hazel', 'heath',
    'hebrew', 'heidi', 'helen', 'helene', 'helsinki', 'henry', 'hicks', 'hindu',
    'hitler', 'hobbs', 'hoffman', 'hogan', 'holmes', 'homer', 'honda', 'horace',
    'howard', 'hudson', 'hugh', 'hughes', 'hurst', 'idaho', 'india', 'indian',
    'indians', 'indie', 'intel', 'iowa', 'iran', 'iranian', 'iraq', 'iraqi',
    'irene', 'irish', 'irving', 'isaac', 'isabel', 'islam', 'islamic', 'israel',
    'israeli', 'italy', 'ivan', 'ivory', 'jackie', 'jacob', 'jacobs', 'jaguars',
    'jaime', 'jakarta', 'jakob', 'james', 'jamie', 'janet', 'janice', 'japan',
    'japanese', 'jason', 'jasper', 'jaynes', 'jeans', 'jenna', 'jenny', 'jerome',
    'jerry', 'jesse', 'jessica', 'jesus', 'jimmy', 'johan', 'johnny', 'jones',
    'jordan', 'jorge', 'josef', 'joseph', 'joshua', 'joyce', 'judas', 'judge',
    'judith', 'jules', 'julia', 'julian', 'julie', 'julio', 'julius', 'june',
    'kafka', 'kansas', 'karen', 'kate', 'kathy', 'katie', 'katrina', 'keith',
    'keller', 'kelly', 'kelvin', 'kennedy', 'kenny', 'kent', 'kenya', 'kevin',
    'khrushchev', 'kiev', 'kimball', 'king', 'kings', 'kirk', 'klein', 'knight',
    'knights', 'korea', 'korean', 'kosovo', 'kramer', 'krishna', 'kuala', 'kurd',
    'kurds', 'kurt', 'kuwait', 'kyle', 'kyoto', 'laden', 'lagos', 'lance',
    'larry', 'latin', 'latino', 'latins', 'latvia', 'laura', 'lauren', 'lawrence',
    'lawyer', 'leahy', 'lebanon', 'leeds', 'leigh', 'lemon', 'lenin', 'leone',
    'leslie', 'lester', 'lewis', 'libya', 'libyan', 'libya', 'liechtenstein',
    'lincoln', 'linda', 'lindsay', 'lions', 'lisa', 'lloyd', 'logan', 'lois',
    'lombard', 'london', 'lopez', 'loren', 'lorenzo', 'louis', 'louise', 'lucas',
    'lucia', 'lucifer', 'lucy', 'luis', 'luke', 'luther', 'lydia', 'lyman',
    'lynch', 'lynn', 'lyons', 'mabel', 'macedonia', 'madame', 'madonna', 'madrid',
    'mafia', 'magna', 'maine', 'maisie', 'major', 'malawi', 'malay', 'malaysia',
    'malcolm', 'maldives', 'malta', 'mambo', 'mamma', 'manga', 'mantle', 'manuel',
    'maori', 'march', 'marco', 'marcus', 'maria', 'marie', 'marilyn', 'mario',
    'marion', 'mark', 'marks', 'marshall', 'martha', 'martin', 'marty', 'marx',
    'mary', 'mason', 'mateo', 'matrix', 'matthews', 'maureen', 'maurice', 'mavis',
    'maxim', 'maxwell', 'maya', 'mayan', 'mayer', 'mazda', 'mccoy', 'mcdonald',
    'mecca', 'medusa', 'megan', 'melanie', 'melissa', 'memphis', 'metro', 'mexican',
    'mexicans', 'mexico', 'meyer', 'miami', 'micah', 'michael', 'michel', 'michelle',
    'mickey', 'middle', 'milan', 'miles', 'miller', 'mills', 'milton', 'mindy',
    'minnesota', 'minnie', 'minor', 'minsk', 'mitchell', 'molly', 'monaco', 'monica',
    'monroe', 'monte', 'moore', 'morgan', 'morris', 'morse', 'morton', 'moses',
    'moslem', 'moslems', 'mother', 'mozart', 'muhammad', 'munich', 'muslim', 'muslims',
    'myers', 'myra', 'myrna', 'nagasaki', 'nancy', 'naomi', 'naples', 'napoleon',
    'nathan', 'nazi', 'nazis', 'nebraska', 'negro', 'negroes', 'neil', 'nellie',
    'nelson', 'nepal', 'neptune', 'nero', 'nevada', 'newman', 'newton', 'nicholas',
    'nicholson', 'nicole', 'niger', 'nigeria', 'nigerian', 'nikki', 'nikon', 'nina',
    'nixon', 'noah', 'nobel', 'noble', 'nolan', 'norma', 'norman', 'norway',
    'norwegian', 'notre', 'nyack', 'oakland', 'oasis', 'oates', 'obama', 'obrien',
    'ocean', 'oceans', 'odessa', 'odyssey', 'ohio', 'oliver', 'olivia', 'olsen',
    'olson', 'olympia', 'olympic', 'olympics', 'omaha', 'omega', 'opera', 'oprah',
    'oracle', 'orange', 'oregon', 'orient', 'oriental', 'orlando', 'oscar', 'oswald',
    'othello', 'ottawa', 'pablo', 'pacific', 'paddy', 'paige', 'pakistan', 'palestinian',
    'palmer', 'pamela', 'panama', 'papal', 'papua', 'paris', 'parker', 'parkinson',
    'pascal', 'patel', 'patricia', 'patrick', 'patty', 'paula', 'pauline', 'pearl',
    'pedro', 'peggy', 'penny', 'pentagon', 'perry', 'persian', 'persians', 'perth',
    'peter', 'peters', 'peterson', 'petersen', 'petra', 'philip', 'phillips', 'phoenix',
    'phyllis', 'pierre', 'piper', 'pittsburgh', 'plato', 'plaza', 'pluto', 'poland',
    'polar', 'poles', 'polish', 'polk', 'polly', 'porter', 'portuguese', 'potter',
    'powell', 'prague', 'pratt', 'preston', 'prince', 'princess', 'princeton', 'priscilla',
    'prometheus', 'protestant', 'prussian', 'ptolemy', 'puerto', 'punic', 'punjab', 'putin',
    'quaker', 'quakers', 'quebec', 'queen', 'queens', 'quentin', 'quinn', 'rabbi',
    'rachel', 'raiders', 'ralph', 'rambo', 'ramona', 'ramos', 'ramsey', 'randall',
    'randy', 'rangers', 'raoul', 'raphael', 'raven', 'ravens', 'raymond', 'reagan',
    'rebecca', 'rebel', 'rebels', 'reese', 'reeves', 'regina', 'reid', 'reilly',
    'reims', 'rene', 'renee', 'reuben', 'reynolds', 'rhine', 'rhoda', 'rhodes',
    'ricardo', 'richard', 'richmond', 'riley', 'ringo', 'riordan', 'rivera', 'roach',
    'robbie', 'robert', 'roberts', 'robertson', 'robin', 'robinson', 'rochester', 'rocky',
    'rodeo', 'rodney', 'roger', 'rogers', 'roland', 'roman', 'romano', 'romans',
    'rome', 'romeo', 'romero', 'ronald', 'rooney', 'roosevelt', 'rosalie', 'rosemary',
    'roses', 'rosie', 'ross', 'rouge', 'rowan', 'roxanne', 'royal', 'royals',
    'ruby', 'rudolf', 'rudolph', 'rudy', 'rufus', 'rugby', 'rupert', 'russell',
    'russia', 'russian', 'russians', 'russo', 'rusty', 'ruth', 'rwanda', 'ryan',
    'sabrina', 'sacramento', 'sahara', 'saint', 'saints', 'salem', 'salina', 'sally',
    'salmon', 'salome', 'samoa', 'samson', 'samuel', 'sandra', 'sandy', 'santa',
    'santiago', 'santo', 'santos', 'sarah', 'sarge', 'sartre', 'satan', 'saudi',
    'saul', 'savage', 'savannah', 'saxon', 'saxons', 'scala', 'schmidt', 'schroeder',
    'schultz', 'schwartz', 'scott', 'scouts', 'sean', 'seattle', 'senegal', 'seoul',
    'september', 'serb', 'serbia', 'serbian', 'serbs', 'sergio', 'seth', 'shadow',
    'shakespeare', 'shane', 'shanghai', 'shannon', 'sharon', 'sharp', 'shaun', 'shawn',
    'sheba', 'sheila', 'shelby', 'shelley', 'sherman', 'sheryl', 'siberia', 'sidney',
    'sierra', 'silas', 'silva', 'silver', 'simon', 'simpson', 'sims', 'sinai',
    'singapore', 'singh', 'sioux', 'sister', 'sisters', 'sloane', 'slovak', 'slovenia',
    'smith', 'snake', 'snyder', 'socrates', 'sofia', 'solomon', 'somalia', 'somali',
    'sonia', 'sonya', 'sophia', 'sophie', 'south', 'soviet', 'soviets', 'space',
    'spain', 'spanish', 'spartan', 'spartans', 'spencer', 'spirit', 'sports', 'spring',
    'springfield', 'sprite', 'stalin', 'stanley', 'stark', 'staten', 'states', 'stefan',
    'steele', 'stein', 'stella', 'stephen', 'stephens', 'sterling', 'steve', 'steven',
    'stevens', 'stevie', 'stewart', 'stockton', 'stone', 'storm', 'stuart', 'sudan',
    'sudanese', 'suez', 'sugar', 'sullivan', 'summer', 'sunday', 'sunny', 'sunset',
    'super', 'susan', 'susie', 'suzanne', 'sweden', 'swedes', 'swedish', 'sweet',
    'swiss', 'sydney', 'sylvia', 'syria', 'syrian', 'syrians', 'tahiti', 'taiwan',
    'taiwanese', 'tampa', 'tango', 'tanya', 'tanzania', 'tara', 'tarzan', 'tate',
    'taylor', 'teddy', 'tehran', 'temple', 'tennessee', 'teresa', 'terri', 'terri',
    'terry', 'tesla', 'tessa', 'texas', 'texan', 'texans', 'thames', 'thanksgiving',
    'thatcher', 'theater', 'thebes', 'theodore', 'theresa', 'thomas', 'thompson', 'thomson',
    'thrace', 'thracian', 'tibet', 'tibetan', 'tiger', 'tigers', 'tigris', 'tiffany',
    'tilden', 'timmy', 'timothy', 'titus', 'tobago', 'toby', 'tokyo', 'toledo',
    'tommy', 'tonga', 'tonic', 'tonto', 'tony', 'torah', 'toronto', 'torres',
    'toyota', 'tracy', 'travis', 'treaty', 'trent', 'trevor', 'tribe', 'tribes',
    'tricia', 'trinity', 'tripoli', 'tristan', 'trojan', 'trojans', 'trout', 'troy',
    'truman', 'trump', 'trudy', 'tsunami', 'tucci', 'tucker', 'tudor', 'tuesday',
    'tulsa', 'tunisia', 'tunisian', 'tupac', 'turin', 'turkey', 'turkish', 'turks',
    'turner', 'tuscany', 'tyler', 'uganda', 'ukraine', 'ukrainian', 'ulster', 'ulysses',
    'uncle', 'union', 'unique', 'united', 'unity', 'uranus', 'urban', 'uruguay',
    'utah', 'vader', 'valdez', 'valentine', 'valley', 'valerie', 'vance', 'vancouver',
    'vanessa', 'vatican', 'vaughan', 'vegas', 'venezuela', 'venice', 'venus', 'vera',
    'vermont', 'vernon', 'veronica', 'versailles', 'vichy', 'vicki', 'victor', 'victoria',
    'vienna', 'vietnam', 'viking', 'vikings', 'villa', 'vince', 'vincent', 'viola',
    'violet', 'virgin', 'virginia', 'virgo', 'vishnu', 'vivian', 'vladimir', 'volga',
    'volta', 'wagner', 'wales', 'walker', 'wallace', 'walsh', 'walter', 'walton',
    'wanda', 'wang', 'warner', 'warren', 'warsaw', 'washington', 'waters', 'watson',
    'watts', 'wayne', 'weber', 'webster', 'wells', 'welsh', 'wendy', 'werner',
    'wesley', 'west', 'western', 'wheeler', 'white', 'whitney', 'wilbur', 'wilde',
    'wilder', 'wiley', 'wilhelm', 'wilkins', 'william', 'williams', 'willis', 'wilson',
    'windsor', 'winston', 'winter', 'winters', 'wisconsin', 'wolf', 'wolfe', 'wolves',
    'wonder', 'woods', 'woody', 'wright', 'wyatt', 'wyoming', 'xerox', 'yahoo',
    'yemen', 'yiddish', 'young', 'youth', 'yukon', 'yvonne', 'zachary', 'zagreb',
    'zaire', 'zambia', 'zane', 'zanzibar', 'zealand', 'zelda', 'zenith', 'zeus',
    'zimbabwe', 'zombie', 'zombies', 'zoning', 'zoology', 'zulu'
}

def is_likely_plural(word):
    """Check if a 5-letter word is likely a plural or past tense."""
    word_lower = word.lower()
    
    # Keep words ending in double-s (bliss, glass, brass, chess, cross, dress, press, etc)
    if word_lower.endswith('ss'):
        return False
    
    # Remove clear plural patterns
    if word_lower.endswith(('ies', 'ves', 'ses', 'xes', 'zes')):
        return True
    
    # Remove -ed past tense forms
    if word_lower.endswith('ed'):
        # But keep some valid words where -ed is part of the root
        if word_lower not in ['abed', 'bled', 'bred', 'fled', 'shed', 'sled', 'sped', 'aced', 'aged', 'axed', 'aped', 'awed', 'dyed', 'eyed', 'iced', 'ohed', 'owed', 'reed', 'seed', 'teed', 'weed', 'deed', 'feed', 'heed', 'meed', 'need', 'peed']:
            third_last = word_lower[-3] if len(word_lower) >= 3 else ''
            # Common -ted, -led, -ned, -ded, -red endings are past tense
            if third_last in 'tlndrmaocipusgkbfvw':
                return True
    
    # Remove words ending in -s with common plural patterns
    if word_lower.endswith('s') and len(word_lower) == 5:
        second_last = word_lower[-2]
        third_last = word_lower[-3] if len(word_lower) >= 3 else ''
        
        # Direct consonant + s endings: -ts, -ds, -ks, -ps, -gs, -ms, -ns, -ls, -rs
        if second_last in 'tdkpgmnlrf':
            # Keep some valid singular words
            if word_lower not in ['atlas', 'basis', 'bonus', 'chaos', 'class', 'crass', 'cross', 'floss', 'focus', 'genus', 'gloss', 'grass', 'gross', 'locus', 'lotus', 'minus', 'nexus', 'oasis', 'opus', 'sinus', 'status', 'torus', 'truss', 'venus', 'virus', 'walrus', 'abyss', 'bliss', 'brass', 'chess', 'dress', 'gloss', 'gross', 'press', 'stress', 'swiss']:
                return True
        
        # Common -es plurals: rules, sales, lines, times, etc.
        #  All words ending in consonant + es are typically plurals
        if second_last == 'e' and third_last in 'lrtndmpkg':
            return True
        
        # -as endings (areas, ideas, etc. are plurals of area, idea)
        if word_lower.endswith('as'):
            if word_lower not in ['atlas', 'texas', 'canvas', 'judas']:
                return True
                
    return False

def is_proper_noun(word):
    """Check if a word is a proper noun."""
    return word.lower() in PROPER_NOUNS

def main():
    if len(sys.argv) != 3:
        print("Usage: filter-plurals-comprehensive.py input.txt output.txt")
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
    removed_plurals = []
    removed_proper = []
    
    for line in lines:
        # Extract just the word (first column, tab-separated)
        parts = line.split('\t')
        word = parts[0] if parts else line
        
        if is_proper_noun(word):
            removed_proper.append(word)
        elif is_likely_plural(word):
            removed_plurals.append(word)
        else:
            kept.append(line)  # Keep the full line with all data
    
    with open(output_file, 'w', encoding='utf-8') as f:
        if header:
            f.write(header + '\n')
        f.write('\n'.join(kept) + '\n')
    
    print(f"Input words: {len(lines)}")
    print(f"Kept: {len(kept)}")
    print(f"Removed plurals/past tense: {len(removed_plurals)}")
    print(f"Removed proper nouns: {len(removed_proper)}")
    print(f"\nSample removed plurals: {', '.join(removed_plurals[:30])}")
    print(f"\nSample removed proper nouns: {', '.join(removed_proper[:30])}")

if __name__ == '__main__':
    main()
