// Shared database module for Cloudflare Workers using Neon serverless driver
import { neon } from "@neondatabase/serverless";

// Create a SQL query function from the environment
export function getDb(env) {
  const sql = neon(env.DATABASE_URL);
  return sql;
}

// Helper to run queries with the sql template tag
export async function query(sql, queryText, params = []) {
  // Convert parameterized query to tagged template format
  // The neon driver uses tagged templates, so we need to handle this
  if (params.length === 0) {
    return await sql(queryText);
  }

  // For parameterized queries, we need to use the query method
  return await sql(queryText, params);
}
