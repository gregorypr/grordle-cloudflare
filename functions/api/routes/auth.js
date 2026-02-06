// Cloudflare Pages Function: auth handler
// Converted from Vercel serverless function

// Hash password using Web Crypto API (available in Workers)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function authHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // Get tenant ID from middleware

  try {
    const body = await c.req.json();
    const { username, password, action } = body;

    // Handle username check action (doesn't require password)
    if (action === "check") {
      if (!username) {
        return c.json({ error: "Username is required" }, 400);
      }

      const trimmedUsername = username.trim().toLowerCase();
      if (!trimmedUsername) {
        return c.json({ error: "Username cannot be empty" }, 400);
      }

      const existingUser = await sql(
        `SELECT id FROM players WHERE LOWER(player_name) = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
        [trimmedUsername, org_id]
      );

      return c.json({ exists: existingUser.length > 0 });
    }

    // For login and register actions, require password
    if (!username || !password) {
      return c.json({ error: "Username and password are required" }, 400);
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      return c.json({ error: "Username cannot be empty" }, 400);
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    if (action === "register") {
      // Check if user already exists in this tenant
      const existingUser = await sql(
        `SELECT id FROM players WHERE LOWER(player_name) = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
        [trimmedUsername, org_id]
      );

      if (existingUser.length > 0) {
        return c.json({ error: "Username already exists" }, 409);
      }

      // Create new user with tenant
      const result = await sql(
        `INSERT INTO players (player_name, password_hash, org_id) VALUES ($1, $2, $3) RETURNING id, player_name;`,
        [trimmedUsername, passwordHash, org_id]
      );

      return c.json({
        success: true,
        message: "User registered successfully",
        user: {
          id: result[0].id,
          username: result[0].player_name
        }
      }, 201);
    } else {
      // Login action (default)
      const userResult = await sql(
        `SELECT id, player_name, password_hash, password_reset_required FROM players WHERE LOWER(player_name) = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
        [trimmedUsername, org_id]
      );

      if (userResult.length === 0) {
        return c.json({
          error: "User not found",
          suggestRegister: true
        }, 404);
      }

      const user = userResult[0];

      // If user is flagged for password reset
      if (user.password_reset_required) {
        if (!password) {
          return c.json({ error: "New password required. Please set a new password to continue." }, 403);
        }
        const newHash = await hashPassword(password);
        await sql(
          `UPDATE players SET password_hash = $1, password_reset_required = FALSE WHERE id = $2;`,
          [newHash, user.id]
        );
        return c.json({
          success: true,
          message: "Password reset successfully. You are now logged in.",
          user: {
            id: user.id,
            username: user.player_name
          }
        });
      }

      // If user exists but has no password (legacy user)
      if (!user.password_hash) {
        await sql(
          `UPDATE players SET password_hash = $1 WHERE id = $2;`,
          [passwordHash, user.id]
        );

        return c.json({
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
        return c.json({ error: "Incorrect password. Please try again or reset your password if you've forgotten it." }, 401);
      }

      return c.json({
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
    return c.json({ error: "Server error" }, 500);
  }
}
