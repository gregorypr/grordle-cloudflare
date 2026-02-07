// Tenant utility functions for multi-tenant queries

/**
 * Get tenant-aware WHERE clause for queries
 * @param {number|null} org_id - Organization ID (null = default tenant)
 * @returns {string} SQL WHERE clause
 */
export function getTenantWhere(org_id) {
  if (org_id === null) {
    return 'org_id IS NULL';
  }
  return `org_id = ${org_id}`;
}

/**
 * Get tenant filter for parameterized queries
 * Use with: WHERE (org_id = $N OR (org_id IS NULL AND $N IS NULL))
 * @param {number|null} org_id - Organization ID
 * @returns {number|null} Value for parameter
 */
export function getTenantParam(org_id) {
  return org_id;
}

/**
 * Add tenant filtering to SQL parameters array
 * @param {Array} params - Existing SQL parameters
 * @param {number|null} org_id - Organization ID
 * @returns {Array} Parameters with org_id added
 */
export function withTenant(params, org_id) {
  return [...params, org_id];
}

/**
 * Build tenant-aware WHERE clause with parameter placeholder
 * @param {number} paramIndex - Parameter index (e.g., $1, $2)
 * @returns {string} SQL WHERE clause
 */
export function tenantFilter(paramIndex) {
  return `(org_id = $${paramIndex} OR (org_id IS NULL AND $${paramIndex} IS NULL))`;
}

/**
 * Simpler approach using COALESCE
 * @param {number} paramIndex - Parameter index
 * @returns {string} SQL WHERE clause using COALESCE
 */
export function tenantFilterSimple(paramIndex) {
  return `COALESCE(org_id, 0) = COALESCE($${paramIndex}, 0)`;
}

// Utility to set admin password for tenant
export async function setTenantAdminPassword(sql, slug) {
  if (!slug || slug === 'grordle') {
    throw new Error('Cannot set admin password for default tenant');
  }
  const newPassword = `${slug}admin`;
  await sql(
    'UPDATE organizations SET admin_password = $1 WHERE slug = $2',
    [newPassword, slug]
  );
  return newPassword;
}

// When creating a new tenant, set admin password to slugname+admin
export async function createTenant(sql, slug, name, display_name, domain) {
  // Insert new tenant
  const result = await sql(
    'INSERT INTO organizations (slug, name, display_name, domain, admin_password) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [slug, name, display_name, domain, `${slug}admin`]
  );
  return result[0];
}

// Utility to update admin passwords for all existing tenants (not default)
export async function updateAllTenantAdminPasswords(sql) {
  const tenants = await sql('SELECT slug FROM organizations WHERE slug != $1', ['grordle']);
  for (const tenant of tenants) {
    const newPassword = `${tenant.slug}admin`;
    await sql('UPDATE organizations SET admin_password = $1 WHERE slug = $2', [newPassword, tenant.slug]);
  }
}
