-- Create table for word votes
CREATE TABLE IF NOT EXISTS word_votes (
  word VARCHAR(32) NOT NULL,
  username VARCHAR(64) NOT NULL,
  vote VARCHAR(8) NOT NULL CHECK (vote IN ('up', 'down')),
  date DATE NOT NULL,
  game_type VARCHAR(16) NOT NULL,
  PRIMARY KEY (word, username, date, game_type)
);
