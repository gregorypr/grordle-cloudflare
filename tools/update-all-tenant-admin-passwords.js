// Script to update admin passwords for all subdomain tenants
import pg from "pg";
import dotenv from "dotenv";
import { updateAllTenantAdminPasswords } from '../functions/api/utils/tenant.js';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    await updateAllTenantAdminPasswords(async (query, params) => {
      return (await client.query(query, params)).rows;
    });
    console.log('✅ Admin passwords updated for all subdomain tenants.');
  } catch (err) {
    console.error('❌ Error updating admin passwords:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
