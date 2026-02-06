# Multi-Tenant Admin Architecture

## Overview

Two-tier admin system with super admin capabilities and tenant-scoped administration.

## Admin Levels

### 🔐 Super Admin (grordle.com)

**Access:** Main domain only (grordle.com)
**Authentication:** Single admin password
**Capabilities:**
- Full system access
- Can view/act as any tenant
- Organization management (CRUD)
- System-wide operations

**Features:**
1. **Organizations Tab**
   - List all organizations with player counts
   - Create new organization
   - Edit organization (slug, name, domain, branding)
   - Delete organization
   - View organization details

2. **Tenant Switcher**
   - Dropdown to select any tenant
   - "View as [Tenant Name]" mode
   - Shows tenant admin panel for selected org
   - Clear indicator of current context

3. **System Tab**
   - Wordlist management (shared resource)
   - Migration tools
   - System health

### 👤 Tenant Admin (All domains)

**Access:** Any domain (grordle.com for default, subdomains for others)
**Authentication:** Admin password (super admin can access any)
**Scope:** Current tenant ONLY

**Features:**
1. **Users Tab**
   - View registered users (scoped to tenant)
   - Reset user passwords
   - Delete users
   - Reset player daily status

2. **Scores Tab**
   - Edit daily scores
   - Edit golf scores

3. **Settings Tab** (NEW)
   - Display name (custom branding)
   - MOTD (message of the day)
   - Colors (primary, secondary)
   - View tenant info (slug, domain)

4. **Danger Zone**
   - Reset all data (tenant-scoped only!)

## API Endpoints

### Super Admin Only

#### Organizations Management
```javascript
GET    /api/manage-organizations          // List all orgs
POST   /api/manage-organizations          // Create org
PUT    /api/manage-organizations          // Update org
DELETE /api/manage-organizations          // Delete org
```

**Create Organization:**
```javascript
POST /api/manage-organizations
{
  "slug": "friends",           // URL slug (friends.grordle.com)
  "name": "Friends Group",     // Internal name
  "display_name": "My Friends",// Custom branding name
  "domain": null,              // Optional custom domain
  "motd": "Welcome!",          // Message of the day
  "primary_color": "#8b5cf6",  // Primary brand color
  "secondary_color": "#7c3aed" // Secondary brand color
}
```

**Response:**
```javascript
{
  "ok": true,
  "organization": {
    "id": 1,
    "slug": "friends",
    "name": "Friends Group",
    "domain": null,
    "created_at": "2026-02-07T..."
  },
  "message": "Organization 'Friends Group' created. Access at: friends.grordle.com"
}
```

### Tenant Admin

#### Tenant Settings
```javascript
GET  /api/tenant-settings     // Get current tenant settings
PUT  /api/tenant-settings     // Update tenant settings
POST /api/tenant-settings     // Update tenant settings
```

**Get Settings:**
```javascript
GET /api/tenant-settings
// Automatically uses org_id from middleware

Response:
{
  "name": "Friends Group",
  "display_name": "My Friends",
  "motd": "Welcome to our word game!",
  "primary_color": "#8b5cf6",
  "secondary_color": "#7c3aed",
  "settings": {}
}
```

**Update Settings:**
```javascript
PUT /api/tenant-settings
{
  "display_name": "Updated Name",
  "motd": "New message!",
  "primary_color": "#3b82f6"
}

Response:
{
  "ok": true,
  "settings": { /* updated settings */ },
  "message": "Tenant settings updated successfully"
}
```

#### User Management (tenant-scoped)
```javascript
POST /api/reset-password      // Reset user password (tenant-scoped)
POST /api/delete-user         // Delete user (tenant-scoped)
POST /api/reset-player-status // Reset daily status (tenant-scoped)
```

#### Data Management (tenant-scoped)
```javascript
POST /api/reset-all-data      // Reset ALL data for THIS tenant only
POST /api/edit-daily-score    // Edit score (tenant-scoped)
POST /api/edit-golf-score     // Edit golf score (tenant-scoped)
```

## Database Schema

### Organizations Table
```sql
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,        -- URL slug
  name TEXT NOT NULL,                -- Internal name
  display_name TEXT,                 -- Custom branding name
  domain TEXT UNIQUE,                -- Custom domain
  admin_password TEXT,               -- Deprecated (super admin has access)
  motd TEXT,                         -- Message of the day
  primary_color TEXT DEFAULT '#8b5cf6',   -- Primary brand color
  secondary_color TEXT DEFAULT '#7c3aed', -- Secondary brand color
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);
```

## Security Model

### Tenant Isolation

All tenant-specific operations automatically scoped by `org_id` from middleware:

```javascript
const org_id = c.get("org_id"); // Set by middleware

// Default tenant (grordle.com): org_id = null
// Other tenants: org_id = 1, 2, 3, ...

// All queries use COALESCE for backward compatibility:
WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
```

### Critical Scoped Operations

These operations are **TENANT-SCOPED** (cannot affect other tenants):

- ✅ `reset-all-data.js` - Only deletes THIS tenant's data
- ✅ `delete-user.js` - Only deletes users from THIS tenant
- ✅ User queries - Only see THIS tenant's users
- ✅ Game queries - Only see THIS tenant's games
- ✅ Score queries - Only see THIS tenant's scores

### Shared Resources

These are **SHARED** across all tenants:

- Wordlist (single source of truth)
- Daily start words (everyone gets same start word)
- Validation words
- System configuration

## Admin UI Components

### Super Admin View (grordle.com)

```jsx
<AdminPanel>
  {isSuperAdmin && (
    <>
      <TenantSwitcher
        organizations={allOrgs}
        currentOrgId={viewingAsOrgId}
        onSwitch={setViewingAsOrgId}
      />

      <OrganizationsTab
        organizations={allOrgs}
        onCreate={createOrg}
        onEdit={editOrg}
        onDelete={deleteOrg}
      />

      <SystemTab />
    </>
  )}

  <TenantAdminPanel orgId={viewingAsOrgId || currentOrgId} />
</AdminPanel>
```

### Tenant Admin View (Any domain)

```jsx
<TenantAdminPanel orgId={currentOrgId}>
  <UsersTab />

  <ScoresTab />

  <SettingsTab
    settings={tenantSettings}
    onUpdate={updateSettings}
  />

  <DangerZone />
</TenantAdminPanel>
```

## User Flow Examples

### Super Admin Creates New Tenant

1. Visit grordle.com/admin
2. Login with super admin password
3. Click "Organizations" tab
4. Click "Create Organization"
5. Fill form:
   - Slug: `friends`
   - Name: `Friends Group`
   - Display Name: `My Friends`
   - MOTD: `Welcome!`
6. Submit
7. System creates organization
8. Configure DNS: `friends.grordle.com` → Cloudflare Pages
9. Users can now register at `friends.grordle.com`

### Super Admin Views Tenant Admin Panel

1. Visit grordle.com/admin
2. Login
3. Use tenant switcher dropdown
4. Select "Friends Group"
5. Now sees "Viewing as: Friends Group" indicator
6. All admin operations scoped to Friends Group
7. Can manage users, scores, settings for that tenant
8. Switch back to "Super Admin" to manage orgs

### Tenant Admin Manages Their Tenant

1. Visit friends.grordle.com/admin
2. Login with admin password
3. See only "Friends Group" users
4. Can:
   - Reset user passwords
   - Edit scores
   - Update MOTD
   - Change branding colors
   - Reset all data (Friends Group only!)
5. Cannot:
   - See other tenants
   - Manage organizations
   - Access system-wide features

## Implementation Status

### ✅ Completed

- Database migration with organizations table
- Tenant detection middleware
- Tenant settings endpoint (GET/PUT)
- Organizations management endpoint (CRUD)
- Critical handlers updated with org_id scoping
- Security: tenant-scoped dangerous operations

### ⏸️ Remaining

- Admin UI components (AdminPanel.jsx updates)
- Tenant switcher UI
- Organizations management UI
- Settings tab UI
- ~15 handler updates (simple pattern)
- Testing

### Next Steps

1. Update AdminPanel.jsx with two-tier structure
2. Add tenant switcher component
3. Add organizations management UI
4. Add settings tab UI
5. Test super admin → tenant switching
6. Test tenant isolation
7. Deploy!
