// api/auth.js
import { Pool } from "pg";
import crypto from "crypto";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function ensureTables() {
  // Ensure players table exists with password_hash column
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add password_hash column if it doesn't exist
  try {
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);
  } catch (e) {
    // Column already exists
  }

  // Add created_at column if it doesn't exist
  try {
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);
  } catch (e) {
    // Column already exists
  }

  // Add password_reset_required column if it doesn't exist
  try {
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE;
    `);
  } catch (e) {
    // Column already exists
  }
}

// Hash password using SHA-256
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    await ensureTables();

    const body = req.body || {};
    const { username, password, action } = body;

    // Handle username check action (doesn't require password)
    if (action === "check") {
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const trimmedUsername = username.trim().toLowerCase();
      if (!trimmedUsername) {
        return res.status(400).json({ error: "Username cannot be empty" });
      }

      const existingUser = await pool.query(
        `SELECT id FROM players WHERE LOWER(player_name) = $1;`,
        [trimmedUsername]
      );

      return res.status(200).json({ 
        exists: existingUser.rows.length > 0 
      });
    }

    // For login and register actions, require password
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      return res.status(400).json({ error: "Username cannot be empty" });
    }

    // Hash the password
    const passwordHash = hashPassword(password);

    if (action === "register") {
      // Check if user already exists
      const existingUser = await pool.query(
        `SELECT id FROM players WHERE LOWER(player_name) = $1;`,
        [trimmedUsername]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Create new user
      const result = await pool.query(
        `INSERT INTO players (player_name, password_hash) VALUES ($1, $2) RETURNING id, player_name;`,
        [trimmedUsername, passwordHash]
      );

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          id: result.rows[0].id,
          username: result.rows[0].player_name
        }
      });
    } else {
      // Login action (default)
      const userResult = await pool.query(
        `SELECT id, player_name, password_hash, password_reset_required FROM players WHERE LOWER(player_name) = $1;`,
        [trimmedUsername]
      );

      if (userResult.rows.length === 0) {
        // User doesn't exist, suggest registration
        return res.status(404).json({ 
          error: "User not found",
          suggestRegister: true 
        });
      }

      const user = userResult.rows[0];

      // If user is flagged for password reset, require new password
      if (user.password_reset_required) {
        // Only allow login if password is being set (e.g., password is not empty and not same as old hash)
        if (!password) {
          return res.status(403).json({ error: "New password required. Please set a new password to continue." });
        }
        // Set new password and clear reset flag
        const newHash = hashPassword(password);
        await pool.query(
          `UPDATE players SET password_hash = $1, password_reset_required = FALSE WHERE id = $2;`,
          [newHash, user.id]
        );
        return res.status(200).json({
          success: true,
          message: "Password reset successfully. You are now logged in.",
          user: {
            id: user.id,
            username: user.player_name
          }
        });
      }

      // If user exists but has no password (legacy user), allow them to set a password
      if (!user.password_hash) {
        await pool.query(
          `UPDATE players SET password_hash = $1 WHERE id = $2;`,
          [passwordHash, user.id]
        );

        return res.status(200).json({
          success: true,
          message: "Password set successfully",
          user: {
            id: user.id,
            username: user.player_name
          }
        });
      }

      // Verify password
      if (user.password_hash !== passwordHash) {
        return res.status(401).json({ error: "Incorrect password. Please try again or reset your password if you've forgotten it." });
      }

      return res.status(200).json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.player_name
        }
      });
    }
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
