// Script to check admin password for a given tenant
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main(slug) {
  if (!slug) {
    console.error('❌ Please provide a tenant slug.');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT admin_password FROM organizations WHERE slug = $1', [slug]);
    if (result.rows.length === 0) {
      console.log('❌ Tenant not found.');
    } else {
      console.log(`Admin password for '${slug}':`, result.rows[0].admin_password);
    }
  } catch (err) {
    console.error('❌ Error checking admin password:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main(process.argv[2]);
