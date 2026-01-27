#!/usr/bin/env node
/**
 * Populate the wordlist table in PostgreSQL database
 * Reads from data/wordlist-table.txt and inserts into database
 */

import { Pool } from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable not set");
  console.error("Please set DATABASE_URL to your PostgreSQL connection string");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function populateWordlist() {
  try {
    console.log("Reading wordlist file...");
    const filePath = join(__dirname, "..", "data", "wordlist-table.txt");
    const fileContent = readFileSync(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");

    // Skip header
    const header = lines[0];
    const dataLines = lines.slice(1);

    console.log(`Found ${dataLines.length} words to insert`);

    // Begin transaction
    await pool.query("BEGIN");

    // Clear existing data
    console.log("Clearing existing wordlist data...");
    await pool.query("DELETE FROM wordlist");

    // Prepare batch insert
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const line of dataLines) {
      const [word, difficulty, scrabbleScore, par] = line.split("\t");
      
      if (!word || !difficulty || !scrabbleScore || !par) {
        console.warn(`Skipping invalid line: ${line}`);
        continue;
      }

      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
      params.push(word, parseFloat(difficulty), parseInt(scrabbleScore), parseInt(par));
      paramIndex += 4;
    }

    if (values.length > 0) {
      console.log("Inserting words into database...");
      const insertQuery = `
        INSERT INTO wordlist (word, difficulty, scrabble_score, par)
        VALUES ${values.join(", ")}
      `;
      
      await pool.query(insertQuery, params);
    }

    // Commit transaction
    await pool.query("COMMIT");

    // Verify insertion
    const result = await pool.query("SELECT COUNT(*), par, COUNT(*) FROM wordlist GROUP BY par ORDER BY par");
    
    console.log("\n✅ Wordlist populated successfully!");
    console.log("\nPAR Distribution:");
    for (const row of result.rows) {
      console.log(`  PAR ${row.par}: ${row.count} words`);
    }

    const totalResult = await pool.query("SELECT COUNT(*) FROM wordlist");
    console.log(`\nTotal words: ${totalResult.rows[0].count}`);

  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ Error populating wordlist:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

populateWordlist().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
