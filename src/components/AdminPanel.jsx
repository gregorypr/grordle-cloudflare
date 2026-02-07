import React, { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { getAustralianDate } from "../utils/dateUtils";
import TabButton from "./TabButton";

// Dummy functions for missing utilities (replace with actual imports if needed)
// ...existing code...

const API_BASE = "/api";

export default function AdminPanel({ onDataChange, playerName }) {
          // Load all registered users for admin view
          async function loadRegisteredUsers() {
            setIsLoadingUsers(true);
            try {
              const today = getAustralianDate();
              const result = await fetchJson(`${API_BASE}/status?date=${today}`);
              const allUsers = result.allPlayers || [];
              setRegisteredUsers(allUsers);
              setShowUsers(true);
            } catch (err) {
              setMessage("Error loading users. Please try again.");
            } finally {
              setIsLoadingUsers(false);
            }
          }
        // Reset a user's password (admin action)
        async function resetUserPassword(userName) {
          if (!window.confirm(`Reset password for user '${userName}'? This will require them to set a new password on next login.`)) return;
          setIsResetting(prev => ({ ...prev, [userName]: true }));
          try {
            const result = await fetchJson(`${API_BASE}/reset-password`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerName: userName })
            });
            if (result.ok) {
              setMessage(`✅ Password reset for ${userName}. They must set a new password on next login.`);
            } else {
              setMessage(`Error: ${result.error || "Failed to reset password"}`);
            }
          } catch (err) {
            setMessage(`Error resetting password: ${err.message}`);
          } finally {
            setIsResetting(prev => ({ ...prev, [userName]: false }));
          }
        }
      // ...existing code...
    // Hardcoded admin password (should be changed in production)
    const ADMIN_PASSWORD = "admin123";

    // Handler for admin login
    async function checkAdminPassword() {
      setIsLoadingAdmin(true);
      try {
        // Fetch admin password for current tenant
        const result = await fetchJson(`${API_BASE}/tenant-settings`);
        const dbAdminPassword = result.admin_password || 'admin123';
        console.log('[AdminPanel] Checking admin password:', { entered: adminPassword, db: dbAdminPassword });
        if (adminPassword === dbAdminPassword) {
          setIsAdmin(true);
          setMessage("");
        } else {
          setMessage("Incorrect password");
        }
      } catch (err) {
        setMessage("Error checking admin password");
      } finally {
        setIsLoadingAdmin(false);
      }
    }
  // State declarations
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  
  // Check if user is "greg" and bypass password
  useEffect(() => {
    if (playerName?.toLowerCase() === 'greg') {
      setIsAdmin(true);
    }
  }, [playerName]);
  
  // ...existing code...
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [isResetting, setIsResetting] = useState({});
  const [isResettingToday, setIsResettingToday] = useState(false);
  const [isResettingAllData, setIsResettingAllData] = useState(false);
  const [isDeleting, setIsDeleting] = useState({});
  const [isMigrating, setIsMigrating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledMigration, setScheduledMigration] = useState(null);
  const [message, setMessage] = useState("");
  const [weeklyRoundCount, setWeeklyRoundCount] = useState(5);
  const [monthlyRoundCount, setMonthlyRoundCount] = useState(10);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Edit score states
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAttempts, setEditAttempts] = useState("");
  const [isEditingDailyScore, setIsEditingDailyScore] = useState(false);
  
  const [golfEditPlayerName, setGolfEditPlayerName] = useState("");
  const [golfEditDate, setGolfEditDate] = useState("");
  const [golfEditHoleNumber, setGolfEditHoleNumber] = useState("");
  const [golfEditAttempts, setGolfEditAttempts] = useState("");
  const [isEditingGolfScore, setIsEditingGolfScore] = useState(false);

  // Multi-tenant state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [viewingAsOrgId, setViewingAsOrgId] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [tenantSettings, setTenantSettings] = useState(null);

  // Organizations CRUD state
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [orgFormData, setOrgFormData] = useState({
    slug: '', name: '', display_name: '', domain: '',
    motd: '', primary_color: '#8b5cf6', secondary_color: '#7c3aed'
  });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Tenant settings state
  const [settingsFormData, setSettingsFormData] = useState({
    display_name: '', motd: '',
    primary_color: '#8b5cf6', secondary_color: '#7c3aed'
  });
  const [isSavingTenantSettings, setIsSavingTenantSettings] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedWeekly = localStorage.getItem('gw_weekly_rounds');
    const savedMonthly = localStorage.getItem('gw_monthly_rounds');
    if (savedWeekly) setWeeklyRoundCount(parseInt(savedWeekly));
    if (savedMonthly) setMonthlyRoundCount(parseInt(savedMonthly));
    
    // Set default date to today
    const today = getAustralianDate();
    setEditDate(today);
    setGolfEditDate(today);
  }, []);

  // Domain detection and initial tab setup
  useEffect(() => {
    const hostname = window.location.hostname;

    // Check if this is super admin domain
    // Super admin = exact match of 'grordle.com', 'localhost', or '127.0.0.1' (no subdomain)
    // Tenant admin = any subdomain like 'friends.grordle.com' or 'friends.localhost'
    const isSuper =
      hostname === 'grordle.com' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('localhost:') || // localhost with port
      hostname.startsWith('127.0.0.1:');   // 127.0.0.1 with port

    setIsSuperAdmin(isSuper);
    setActiveTab(isSuper ? 'organizations' : 'users');

    console.log('[AdminPanel] Domain detection:', { hostname, isSuper });
  }, []);

  // Load organizations (super admin only)
  useEffect(() => {
    if (isAdmin && isSuperAdmin) {
      loadOrganizations();
    }
  }, [isAdmin, isSuperAdmin]);

  // Load tenant settings
  useEffect(() => {
    if (isAdmin) {
      loadTenantSettings();
    }
  }, [isAdmin, viewingAsOrgId]);

  // Load organizations (super admin only)
  async function loadOrganizations() {
    try {
      const result = await fetchJson(`${API_BASE}/manage-organizations`);
      if (result.ok) {
        setOrganizations(result.organizations || []);
      } else {
        console.error("[Admin] Failed to load organizations:", result.error);
      }
    } catch (err) {
      console.error("[Admin] Error loading organizations:", err);
      setMessage("Error loading organizations");
    }
  }

  // Load tenant settings
  async function loadTenantSettings() {
    try {
      const result = await fetchJson(`${API_BASE}/tenant-settings`);
      setTenantSettings(result);
      if (result.display_name || result.motd || result.primary_color || result.secondary_color) {
        setSettingsFormData({
          display_name: result.display_name || '',
          motd: result.motd || '',
          primary_color: result.primary_color || '#8b5cf6',
          secondary_color: result.secondary_color || '#7c3aed'
        });
      }
    } catch (err) {
      console.error("[Admin] Error loading tenant settings:", err);
    }
  }

  const resetPlayerStatus = async (userName) => {
    if (!confirm(`Reset today's played status for ${userName}? This will clear their game, score, and allow them to play again today.`)) {
      return;
    }

    setIsResetting(prev => ({ ...prev, [userName]: true }));
    try {
      const today = getAustralianDate();
      console.log(`[Admin] Resetting player status for ${userName} on date ${today}`);
      const result = await fetchJson(`${API_BASE}/reset-player-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: userName,
          date: today
        })
      });
      console.log("[Admin] reset-player-status response:", result);

      if (result.ok) {
        setMessage(`✅ Successfully reset status for ${userName}`);
        // Reload the users list to show updated status
        console.log("[Admin] Reloading user list...");
        loadRegisteredUsers();
      } else {
        console.error("[Admin] Failed to reset player status:", result.error);
        setMessage(`Error: ${result.error || "Failed to reset player status"}`);
      }
    } catch (err) {
      console.error("[Admin] Error resetting player status", err);
      setMessage("Error resetting player status. Please try again.");
    } finally {
      setIsResetting(prev => ({ ...prev, [userName]: false }));
    }
  };

  const resetTodayResults = async () => {
    if (!confirm(`Reset ALL today's results? This will clear all player statuses, scores, and games for today. Players will be able to play again today. This cannot be undone!`)) {
      return;
    }

    setIsResettingToday(true);
    try {
      const today = getAustralianDate();
      const result = await fetchJson(`${API_BASE}/reset-player-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: "ALL",
          date: today
        })
      });

      if (result.ok) {
        setMessage(`✅ Successfully reset all today's results`);
        // Reload the users list to show updated status
        if (showUsers) {
          loadRegisteredUsers();
        }
        // Trigger parent component refresh
        if (onDataChange) {
          onDataChange();
        }
      } else {
        setMessage(`Error: ${result.error || "Failed to reset today's results"}`);
      }
    } catch (err) {
      console.error("Error resetting today's results", err);
      setMessage("Error resetting today's results. Please try again.");
    } finally {
      setIsResettingToday(false);
    }
  };

  const resetAllData = async () => {
    const password = prompt("⚠️ WARNING: This will permanently delete ALL users, games, and scores. This CANNOT be undone!\n\nType the admin password to confirm:");
    
    if (!password) {
      return;
    }

    console.log("Calling reset-all-data API...");
    setIsResettingAllData(true);
    try {
      const result = await fetchJson(`${API_BASE}/reset-all-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPassword: password
        })
      });

      console.log("Reset all data result:", result);

      if (result.ok) {
        setMessage(`✅ All data has been reset`);
        setRegisteredUsers([]);
        setShowUsers(false);
        // Clear localStorage to remove any cached data
        localStorage.removeItem("gw_member_start_words_v1");
        // Trigger parent component refresh
        if (onDataChange) {
          onDataChange();
        }
      } else {
        console.error("Reset failed:", result.error);
        setMessage(`Error: ${result.error || "Failed to reset all data"}`);
      }
    } catch (err) {
      console.error("Error resetting all data", err);
      setMessage(`Error resetting all data: ${err.message || "Unknown error"}`);
    } finally {
      setIsResettingAllData(false);
    }
  };

  const deleteUser = async (userName) => {
    if (!confirm(`Permanently delete user ${userName}? This will remove all their data including games, scores, and history. This cannot be undone!`)) {
      return;
    }

    setIsDeleting(prev => ({ ...prev, [userName]: true }));
    try {
      const result = await fetchJson(`${API_BASE}/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: userName
        })
      });

      if (result.ok) {
        setMessage(`✅ Successfully deleted user ${userName}`);
        // Reload the users list to reflect deletion
        loadRegisteredUsers();
      } else {
        setMessage(`Error: ${result.error || "Failed to delete user"}`);
      }
    } catch (err) {
      console.error("Error deleting user", err);
      setMessage("Error deleting user. Please try again.");
    } finally {
      setIsDeleting(prev => ({ ...prev, [userName]: false }));
    }
  };

  // Check for scheduled migration status
  const checkScheduledMigration = async () => {
    try {
      const result = await fetchJson(`${API_BASE}/schedule-wordlist-migration`);
      setScheduledMigration(result);
    } catch (err) {
      console.error("[Admin] Error checking scheduled migration:", err);
    }
  };

  // Load scheduled migration status on mount
  useEffect(() => {
    if (isAdmin) {
      checkScheduledMigration();
    }
  }, [isAdmin]);

  const scheduleWordlistMigration = async () => {
    if (!confirm("Schedule wordlist migration for midnight Sydney time?\n\nThe migration will run at the next midnight (Sydney time).")) {
      return;
    }

    setIsScheduling(true);
    try {
      console.log("[Admin] Scheduling wordlist migration...");
      const result = await fetchJson(`${API_BASE}/schedule-wordlist-migration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: "admin123"
        })
      });
      console.log("[Admin] schedule-wordlist-migration response:", result);

      if (result.ok) {
        setMessage(`✅ ${result.message}`);
        setScheduledMigration({ scheduled: true, scheduledFor: result.scheduledFor, currentSydneyTime: result.currentSydneyTime });
      } else {
        setMessage(`Error: ${result.error || "Failed to schedule migration"}`);
      }
    } catch (err) {
      console.error("[Admin] Error scheduling wordlist migration", err);
      setMessage(`Error scheduling migration: ${err.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const cancelScheduledMigration = async () => {
    if (!confirm("Cancel the scheduled wordlist migration?")) {
      return;
    }

    setIsScheduling(true);
    try {
      const result = await fetchJson(`${API_BASE}/schedule-wordlist-migration`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: "admin123"
        })
      });

      if (result.ok) {
        setMessage(`✅ ${result.message}`);
        setScheduledMigration({ scheduled: false });
      } else {
        setMessage(`Error: ${result.error || "Failed to cancel migration"}`);
      }
    } catch (err) {
      console.error("[Admin] Error cancelling scheduled migration", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const migrateWordlist = async () => {
    if (!confirm("Migrate wordlist from master data file?\n\nThis will:\n- Delete all existing words in the database\n- Repopulate from data/wordlist-table-cleaned.txt\n- Update all word statistics\n\nContinue?")) {
      return;
    }

    setIsMigrating(true);
    try {
      console.log("[Admin] Starting wordlist migration...");
      const result = await fetchJson(`${API_BASE}/migrate-wordlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: "admin123"
        })
      });
      console.log("[Admin] migrate-wordlist response:", result);

      if (result.ok) {
        const msg = `✅ Migration complete!\n` +
                   `Deleted: ${result.deletedCount} words\n` +
                   `Imported: ${result.importedCount} words\n` +
                   `Par range: ${result.stats.parRange}\n` +
                   `Avg difficulty: ${result.stats.avgDifficulty}`;
        setMessage(msg);
        console.log("[Admin] Migration successful:", result);

        // Show distribution details
        if (result.distribution && result.distribution.length > 0) {
          console.log("[Admin] Par distribution:", result.distribution);
        }
      } else {
        console.error("[Admin] Failed to migrate wordlist:", result.error);
        setMessage(`Error: ${result.error || "Failed to migrate wordlist"}`);
      }
    } catch (err) {
      console.error("[Admin] Error migrating wordlist", err);
      setMessage(`Error migrating wordlist: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // CRUD functions for Organizations
  async function createOrganization() {
    if (!orgFormData.slug || !orgFormData.name) {
      setMessage("Slug and Name are required");
      return;
    }

    setIsCreatingOrg(true);
    try {
      const result = await fetchJson(`${API_BASE}/manage-organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgFormData)
      });

      if (result.ok) {
        setMessage(`✅ Organization created: ${orgFormData.name}`);
        setShowOrgForm(false);
        setOrgFormData({
          slug: '', name: '', display_name: '', domain: '',
          motd: '', primary_color: '#8b5cf6', secondary_color: '#7c3aed'
        });
        loadOrganizations();
      } else {
        setMessage(`Error: ${result.error || "Failed to create organization"}`);
      }
    } catch (err) {
      console.error("[Admin] Error creating organization:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsCreatingOrg(false);
    }
  }

  async function updateOrganization() {
    if (!editingOrgId || !orgFormData.slug || !orgFormData.name) {
      setMessage("Slug and Name are required");
      return;
    }

    setIsCreatingOrg(true);
    try {
      const result = await fetchJson(`${API_BASE}/manage-organizations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingOrgId, ...orgFormData })
      });

      if (result.ok) {
        setMessage(`✅ Organization updated: ${orgFormData.name}`);
        setShowOrgForm(false);
        setEditingOrgId(null);
        setOrgFormData({
          slug: '', name: '', display_name: '', domain: '',
          motd: '', primary_color: '#8b5cf6', secondary_color: '#7c3aed'
        });
        loadOrganizations();
      } else {
        setMessage(`Error: ${result.error || "Failed to update organization"}`);
      }
    } catch (err) {
      console.error("[Admin] Error updating organization:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsCreatingOrg(false);
    }
  }

  async function deleteOrganization(orgId, orgName) {
    const password = prompt(`⚠️ DELETE ORGANIZATION: ${orgName}\n\nThis will permanently delete the organization and all associated data.\n\nType the admin password to confirm:`);

    if (!password) return;

    try {
      const result = await fetchJson(`${API_BASE}/manage-organizations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orgId, confirmPassword: password })
      });

      if (result.ok) {
        setMessage(`✅ Organization deleted: ${orgName}`);
        loadOrganizations();
      } else {
        setMessage(`Error: ${result.error || "Failed to delete organization"}`);
      }
    } catch (err) {
      console.error("[Admin] Error deleting organization:", err);
      setMessage(`Error: ${err.message}`);
    }
  }

  // Save tenant settings
  async function saveTenantSettings() {
    setIsSavingTenantSettings(true);
    try {
      const result = await fetchJson(`${API_BASE}/tenant-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsFormData)
      });

      if (result.ok) {
        setMessage(`✅ Settings saved successfully`);
        loadTenantSettings();
      } else {
        setMessage(`Error: ${result.error || "Failed to save settings"}`);
      }
    } catch (err) {
      console.error("[Admin] Error saving tenant settings:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsSavingTenantSettings(false);
    }
  }

  // TAB RENDER FUNCTIONS

  function renderUsersTab() {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Registered Users</h3>
          <button
            onClick={loadRegisteredUsers}
            disabled={isLoadingUsers}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition text-sm"
          >
            {isLoadingUsers ? "Loading..." : showUsers ? "Refresh" : "View Users"}
          </button>
        </div>

        {showUsers && (
          <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
            {registeredUsers.length === 0 ? (
              <p className="text-purple-200 text-center">No users registered yet</p>
            ) : (
              <div className="space-y-2">
                {registeredUsers.map((user, idx) => (
                  <div key={idx} className="bg-white/10 rounded p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold">{user.name}</span>
                      <span className={`text-sm ${
                        user.score !== null ? 'text-green-400' : 'text-purple-400'
                      }`}>
                        {user.score !== null ? `Played (${user.score} tries)` : 'Not yet played'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetPlayerStatus(user.name)}
                        disabled={isResetting[user.name]}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-bold transition"
                      >
                        {isResetting[user.name] ? "Resetting..." : "Reset Today"}
                      </button>
                      <button
                        onClick={() => resetUserPassword(user.name)}
                        disabled={isResetting[user.name]}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-bold transition"
                      >
                        {isResetting[user.name] ? "Resetting..." : "Reset Password"}
                      </button>
                      <button
                        onClick={() => deleteUser(user.name)}
                        disabled={isDeleting[user.name]}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-bold transition"
                      >
                        {isDeleting[user.name] ? "Deleting..." : "Delete User"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderScoresTab() {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white">Edit Scores</h3>

        {/* Edit Daily Game Score */}
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-3">Edit Daily Game Score</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Player Name"
              value={editPlayerName}
              onChange={(e) => setEditPlayerName(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <input
              type="number"
              placeholder="New Attempts"
              min="1"
              max="8"
              value={editAttempts}
              onChange={(e) => setEditAttempts(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <button
              onClick={async () => {
                if (!editPlayerName || !editDate || !editAttempts) {
                  setMessage("❌ Please fill all fields");
                  return;
                }
                setIsEditingDailyScore(true);
                try {
                  console.log("Sending edit request:", {
                    playerName: editPlayerName,
                    date: editDate,
                    attempts: parseInt(editAttempts)
                  });

                  const result = await fetchJson(`${API_BASE}/edit-daily-score`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      playerName: editPlayerName,
                      date: editDate,
                      attempts: parseInt(editAttempts),
                      adminPassword: "admin123"
                    })
                  });

                  console.log("Edit result:", result);

                  if (result.ok) {
                    setMessage(`✅ ${result.message}`);
                    setEditPlayerName("");
                    setEditAttempts("");
                    if (onDataChange) onDataChange();
                  } else {
                    setMessage(`❌ ${result.error || JSON.stringify(result)}`);
                  }
                } catch (err) {
                  console.error("Edit error:", err);
                  setMessage(`❌ Error: ${err.message || String(err)}`);
                } finally {
                  setIsEditingDailyScore(false);
                }
              }}
              disabled={isEditingDailyScore}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-bold transition text-sm"
            >
              {isEditingDailyScore ? "Updating..." : "Update Daily Score"}
            </button>
          </div>
        </div>

        {/* Edit Golf Score */}
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-3">Edit Golf Hole Score</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Player Name"
              value={golfEditPlayerName}
              onChange={(e) => setGolfEditPlayerName(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <input
              type="date"
              value={golfEditDate}
              onChange={(e) => setGolfEditDate(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <input
              type="number"
              placeholder="Hole Number (1-9)"
              min="1"
              max="9"
              value={golfEditHoleNumber}
              onChange={(e) => setGolfEditHoleNumber(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <input
              type="number"
              placeholder="New Attempts"
              min="1"
              value={golfEditAttempts}
              onChange={(e) => setGolfEditAttempts(e.target.value)}
              className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
            />
            <button
              onClick={async () => {
                if (!golfEditPlayerName || !golfEditDate || !golfEditHoleNumber || !golfEditAttempts) {
                  setMessage("❌ Please fill all fields");
                  return;
                }
                setIsEditingGolfScore(true);
                try {
                  const result = await fetchJson(`${API_BASE}/edit-golf-score`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      playerName: golfEditPlayerName,
                      date: golfEditDate,
                      holeNumber: parseInt(golfEditHoleNumber),
                      attempts: parseInt(golfEditAttempts),
                      adminPassword: "admin123"
                    })
                  });

                  if (result.ok) {
                    setMessage(`✅ ${result.message}`);
                    setGolfEditPlayerName("");
                    setGolfEditHoleNumber("");
                    setGolfEditAttempts("");
                    console.log("Calling onDataChange to refresh leaderboards");
                    if (onDataChange) onDataChange();
                  } else {
                    setMessage(`❌ ${result.error}`);
                  }
                } catch (err) {
                  console.error("Golf edit error:", err);
                  setMessage(`❌ Error: ${err.message}`);
                } finally {
                  setIsEditingGolfScore(false);
                }
              }}
              disabled={isEditingGolfScore}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-bold transition text-sm"
            >
              {isEditingGolfScore ? "Updating..." : "Update Golf Score"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDangerTab() {
    return (
      <div className="space-y-6">
        {/* Match Settings */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">⚙️ Match Settings</h3>
          <p className="text-purple-200 text-sm mb-4">
            Configure how many rounds contribute to weekly and monthly match calculations.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Number of rounds for Weekly Match
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={weeklyRoundCount}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseInt(val);
                  if (!isNaN(num) && num >= 1 && num <= 20) {
                    setWeeklyRoundCount(num);
                  } else if (val === '') {
                    setWeeklyRoundCount('');
                  }
                }}
                onBlur={(e) => {
                  if (weeklyRoundCount === '' || weeklyRoundCount < 1) {
                    setWeeklyRoundCount(1);
                  }
                }}
                className="w-full p-3 rounded-lg bg-white/20 text-white border-2 border-white/30 focus:border-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Number of rounds for Monthly Match
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={monthlyRoundCount}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseInt(val);
                  if (!isNaN(num) && num >= 1 && num <= 50) {
                    setMonthlyRoundCount(num);
                  } else if (val === '') {
                    setMonthlyRoundCount('');
                  }
                }}
                onBlur={(e) => {
                  if (monthlyRoundCount === '' || monthlyRoundCount < 1) {
                    setMonthlyRoundCount(1);
                  }
                }}
                className="w-full p-3 rounded-lg bg-white/20 text-white border-2 border-white/30 focus:border-white focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                setIsSavingSettings(true);
                localStorage.setItem('gw_weekly_rounds', weeklyRoundCount.toString());
                localStorage.setItem('gw_monthly_rounds', monthlyRoundCount.toString());
                setMessage(`✅ Settings saved: Weekly=${weeklyRoundCount}, Monthly=${monthlyRoundCount}`);
                setTimeout(() => setIsSavingSettings(false), 500);
              }}
              disabled={isSavingSettings}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
            >
              {isSavingSettings ? "Saving..." : "💾 Save Settings"}
            </button>
          </div>
        </div>

        {/* Reset Today's Results */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Reset Today's Results</h3>
          <p className="text-purple-200 text-sm mb-4">
            This will clear all player statuses, scores, and games for today. All players will be able to play again.
          </p>
          <button
            onClick={resetTodayResults}
            disabled={isResettingToday}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            {isResettingToday ? "Resetting..." : "Reset All Today's Results"}
          </button>
        </div>

        {/* Reset Daily Golf Course */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">⛳ Reset Daily Golf Course</h3>
          <p className="text-purple-200 text-sm mb-4">
            This will delete today's golf course. A new course will be generated when the next player starts golf.
          </p>
          <button
            onClick={async () => {
              if (!confirm("Reset today's golf course? This will generate new words for all 9 holes.")) return;
              try {
                const result = await fetchJson(`${API_BASE}/reset-daily-golf-course`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminPassword: "admin123" })
                });
                if (result.ok) {
                  setMessage(`✅ ${result.message}`);
                  if (onDataChange) onDataChange();
                } else {
                  setMessage(`❌ ${result.error}`);
                }
              } catch (err) {
                setMessage(`❌ Error: ${err.message}`);
              }
            }}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            Reset Golf Course
          </button>
        </div>

        {/* Reset All Golf Rounds */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">⛳ Reset All Golf Rounds (Today)</h3>
          <p className="text-purple-200 text-sm mb-4">
            This will delete all player golf rounds that were started today. Players can then start fresh rounds with the new course.
          </p>
          <button
            onClick={async () => {
              if (!confirm("Reset all golf rounds for today? All players who started golf today will need to start over.")) return;
              try {
                const result = await fetchJson(`${API_BASE}/reset-all-golf-rounds`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminPassword: "admin123" })
                });
                if (result.ok) {
                  setMessage(`✅ ${result.message}`);
                  if (onDataChange) onDataChange();
                } else {
                  setMessage(`❌ ${result.error}`);
                }
              } catch (err) {
                setMessage(`❌ Error: ${err.message}`);
              }
            }}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            Reset All Golf Rounds
          </button>
        </div>

        {/* Reset All Data */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">⚠️ Reset All Data</h3>
          <p className="text-purple-200 text-sm mb-4">
            DANGER ZONE: This will permanently delete ALL users, games, scores, and history. This action cannot be undone!
          </p>
          <button
            onClick={resetAllData}
            disabled={isResettingAllData}
            className="w-full py-3 bg-red-800 hover:bg-red-900 disabled:bg-gray-600 text-white rounded-lg font-bold transition border-2 border-red-600"
          >
            {isResettingAllData ? "Resetting..." : "🗑️ Delete All Users & Data"}
          </button>
        </div>
      </div>
    );
  }

  function renderSystemTab() {
    return (
      <div className="space-y-6">
        {/* Clear Wordlist Cache */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">🔄 Clear Wordlist Cache</h3>
          <p className="text-purple-200 text-sm mb-4">
            Clear the cached wordlist to reload words from the server. Use this if words appear that shouldn't be in the game.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("gw_wordlist_v1");
              localStorage.removeItem("gw_wordlist_v2");
              localStorage.removeItem("gw_wordlist_v3");
              setMessage("✅ Wordlist cache cleared. Please refresh the page (F5).");
            }}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition"
          >
            🗑️ Clear Wordlist Cache
          </button>
        </div>

        {/* Wordlist Migration */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">📚 Wordlist Migration</h3>
          <p className="text-purple-200 text-sm mb-4">
            Repopulate the wordlist database from the master data file (data/wordlist-table-cleaned.txt). Use this after updating the wordlist file.
          </p>

          {/* Scheduled Migration Status */}
          {scheduledMigration?.scheduled && (
            <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3 mb-4">
              <p className="text-yellow-200 text-sm">
                <span className="font-bold">Migration scheduled for:</span> {scheduledMigration.scheduledFor} (midnight Sydney time)
              </p>
              {scheduledMigration.currentSydneyTime && (
                <p className="text-yellow-200/70 text-xs mt-1">
                  Current Sydney time: {scheduledMigration.currentSydneyTime}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={migrateWordlist}
              disabled={isMigrating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
            >
              {isMigrating ? "Migrating..." : "🔄 Run Migration Now"}
            </button>

            {scheduledMigration?.scheduled ? (
              <button
                onClick={cancelScheduledMigration}
                disabled={isScheduling}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
              >
                {isScheduling ? "Cancelling..." : "❌ Cancel Scheduled Migration"}
              </button>
            ) : (
              <button
                onClick={scheduleWordlistMigration}
                disabled={isScheduling}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
              >
                {isScheduling ? "Scheduling..." : "⏰ Schedule for Midnight (Sydney)"}
              </button>
            )}
          </div>
        </div>

        {/* Validation Wordlist */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">✅ Validation Wordlist (Filtered Wordle List)</h3>
          <p className="text-purple-200 text-sm mb-4">
            Import filtered Wordle wordlist (~13,900 words) for validation. Players can guess these words, but they will never be selected as target/start words. Plurals and -ED words removed.
          </p>
          <button
            onClick={async () => {
              if (!confirm("Import validation wordlist?\n\nThis will:\n- Import ~13,900 words from wordle-answers-filtered.txt\n- Allow players to guess any valid Wordle word (no plurals/proper nouns)\n- Target words still come from curated 3,306-word list\n\nContinue?")) {
                return;
              }
              setIsMigrating(true);
              try {
                const result = await fetchJson(`${API_BASE}/import-validation-wordlist`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" }
                });
                if (result.ok) {
                  setMessage(`✅ Imported ${result.count} validation words`);
                } else {
                  setMessage(`❌ Error: ${result.error}`);
                }
              } catch (err) {
                setMessage(`❌ Error: ${err.message}`);
              } finally {
                setIsMigrating(false);
              }
            }}
            disabled={isMigrating}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            {isMigrating ? "Importing..." : "📥 Import Validation Wordlist (~13,900 words)"}
          </button>
        </div>

        {/* Create Indexes */}
        <div className="bg-white/5 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">⚡ Create Database Indexes</h3>
          <p className="text-purple-200 text-sm mb-4">
            Create indexes on word columns for faster validation lookups. Run this after importing wordlists for optimal performance.
          </p>
          <button
            onClick={async () => {
              setIsMigrating(true);
              try {
                const result = await fetchJson(`${API_BASE}/create-indexes`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" }
                });
                if (result.ok) {
                  setMessage(`✅ Indexes created: ${result.indexes.length} indexes active`);
                } else {
                  setMessage(`❌ Error: ${result.error}`);
                }
              } catch (err) {
                setMessage(`❌ Error: ${err.message}`);
              } finally {
                setIsMigrating(false);
              }
            }}
            disabled={isMigrating}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            {isMigrating ? "Creating..." : "⚡ Create Indexes for Performance"}
          </button>
        </div>
      </div>
    );
  }

  function renderSettingsTab() {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-white mb-4">⚙️ Tenant Settings</h3>

        {/* Read-only Organization Info */}
        {tenantSettings && (
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <h4 className="text-lg font-semibold text-white mb-3">Organization Information</h4>
            <div className="space-y-2 text-purple-200">
              <div><span className="font-semibold">Name:</span> {tenantSettings.name || 'N/A'}</div>
              <div><span className="font-semibold">Slug:</span> {tenantSettings.slug || 'N/A'}</div>
              <div><span className="font-semibold">Domain:</span> {tenantSettings.domain || 'N/A'}</div>
            </div>
          </div>
        )}

        {/* Editable Settings Form */}
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-3">Branding & Display Settings</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={settingsFormData.display_name}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, display_name: e.target.value })}
                placeholder="Organization Display Name"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Message of the Day (MOTD)
              </label>
              <textarea
                value={settingsFormData.motd}
                onChange={(e) => setSettingsFormData({ ...settingsFormData, motd: e.target.value })}
                placeholder="Welcome message or announcement"
                rows="3"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settingsFormData.primary_color}
                  onChange={(e) => setSettingsFormData({ ...settingsFormData, primary_color: e.target.value })}
                  className="h-12 w-16 rounded-lg border-2 border-white/30 cursor-pointer"
                />
                <input
                  type="text"
                  value={settingsFormData.primary_color}
                  onChange={(e) => setSettingsFormData({ ...settingsFormData, primary_color: e.target.value })}
                  placeholder="#8b5cf6"
                  className="flex-1 p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Secondary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settingsFormData.secondary_color}
                  onChange={(e) => setSettingsFormData({ ...settingsFormData, secondary_color: e.target.value })}
                  className="h-12 w-16 rounded-lg border-2 border-white/30 cursor-pointer"
                />
                <input
                  type="text"
                  value={settingsFormData.secondary_color}
                  onChange={(e) => setSettingsFormData({ ...settingsFormData, secondary_color: e.target.value })}
                  placeholder="#7c3aed"
                  className="flex-1 p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={saveTenantSettings}
              disabled={isSavingTenantSettings}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold transition"
            >
              {isSavingTenantSettings ? "Saving..." : "💾 Save Settings"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderOrganizationsTab() {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Organizations</h3>
          <button
            onClick={() => {
              setShowOrgForm(!showOrgForm);
              setEditingOrgId(null);
              setOrgFormData({
                slug: '', name: '', display_name: '', domain: '',
                motd: '', primary_color: '#8b5cf6', secondary_color: '#7c3aed'
              });
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition text-sm"
          >
            {showOrgForm ? "Cancel" : "+ New Organization"}
          </button>
        </div>

        {/* Create/Edit Form */}
        {showOrgForm && (
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-white mb-3">
              {editingOrgId ? "Edit Organization" : "Create New Organization"}
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Slug (URL identifier, e.g., 'friends')"
                value={orgFormData.slug}
                onChange={(e) => setOrgFormData({ ...orgFormData, slug: e.target.value })}
                className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Internal Name (required)"
                value={orgFormData.name}
                onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Display Name (optional)"
                value={orgFormData.display_name}
                onChange={(e) => setOrgFormData({ ...orgFormData, display_name: e.target.value })}
                className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Custom Domain (optional)"
                value={orgFormData.domain}
                onChange={(e) => setOrgFormData({ ...orgFormData, domain: e.target.value })}
                className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
              />
              <textarea
                placeholder="Message of the Day (optional)"
                value={orgFormData.motd}
                onChange={(e) => setOrgFormData({ ...orgFormData, motd: e.target.value })}
                rows="2"
                className="w-full p-2 rounded bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:border-white focus:outline-none text-sm"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-purple-200 text-xs mb-1">Primary Color</label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={orgFormData.primary_color}
                      onChange={(e) => setOrgFormData({ ...orgFormData, primary_color: e.target.value })}
                      className="h-10 w-12 rounded border border-white/30 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={orgFormData.primary_color}
                      onChange={(e) => setOrgFormData({ ...orgFormData, primary_color: e.target.value })}
                      className="flex-1 p-2 rounded bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none text-xs"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-purple-200 text-xs mb-1">Secondary Color</label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={orgFormData.secondary_color}
                      onChange={(e) => setOrgFormData({ ...orgFormData, secondary_color: e.target.value })}
                      className="h-10 w-12 rounded border border-white/30 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={orgFormData.secondary_color}
                      onChange={(e) => setOrgFormData({ ...orgFormData, secondary_color: e.target.value })}
                      className="flex-1 p-2 rounded bg-white/20 text-white border border-white/30 focus:border-white focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={editingOrgId ? updateOrganization : createOrganization}
                disabled={isCreatingOrg}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-bold transition text-sm"
              >
                {isCreatingOrg ? "Saving..." : (editingOrgId ? "Update Organization" : "Create Organization")}
              </button>
            </div>
          </div>
        )}

        {/* Organizations List */}
        <div className="bg-white/10 rounded-lg p-4">
          {organizations.length === 0 ? (
            <p className="text-purple-200 text-center">No organizations yet</p>
          ) : (
            <div className="space-y-2">
              {organizations.map((org) => (
                <div key={org.id} className="bg-white/10 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">{org.name}</span>
                        <span className="text-xs text-purple-300">({org.slug})</span>
                        {org.player_count > 0 && (
                          <span className="text-xs text-green-400">{org.player_count} players</span>
                        )}
                      </div>
                      {org.display_name && (
                        <div className="text-sm text-purple-200">Display: {org.display_name}</div>
                      )}
                      {org.domain && (
                        <div className="text-sm text-purple-200">Domain: {org.domain}</div>
                      )}
                      {org.motd && (
                        <div className="text-xs text-purple-300 mt-1 italic">{org.motd}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingOrgId(org.id);
                          setOrgFormData({
                            slug: org.slug,
                            name: org.name,
                            display_name: org.display_name || '',
                            domain: org.domain || '',
                            motd: org.motd || '',
                            primary_color: org.primary_color || '#8b5cf6',
                            secondary_color: org.secondary_color || '#7c3aed'
                          });
                          setShowOrgForm(true);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOrganization(org.id, org.name)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6">Admin Panel</h2>
      {!isAdmin ? (
        <div className="space-y-4">
          <input
            type="password"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full p-4 rounded-lg text-lg bg-white/20 text-white placeholder-purple-200 border-2 border-white/30 focus:border-white focus:outline-none"
            onKeyDown={e => e.key === "Enter" && checkAdminPassword()}
          />
          <button
            onClick={checkAdminPassword}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition"
          >
            Login
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Logout Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                localStorage.removeItem("grordle_authenticated");
                localStorage.removeItem("grordle_username");
                localStorage.removeItem("grordle_password");
                localStorage.removeItem("grordle_remember");
                window.location.reload();
              }}
              className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>

          {/* Tenant Switcher - Super Admin Only */}
          {isSuperAdmin && (
            <div className="bg-white/5 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-white font-semibold">Viewing as:</label>
                <select
                  value={viewingAsOrgId || 'super'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newOrgId = val === 'super' ? null : parseInt(val);
                    setViewingAsOrgId(newOrgId);

                    // Auto-switch tab when changing modes
                    if (newOrgId === null) {
                      // Switched to super admin mode
                      setActiveTab('organizations');
                    } else {
                      // Switched to tenant mode
                      setActiveTab('users');
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-white border-2 border-purple-500 focus:border-purple-400 focus:outline-none"
                  style={{ color: 'white' }}
                >
                  <option value="super" className="bg-gray-800 text-white">🔐 Super Admin</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id} className="bg-gray-800 text-white">
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

              {viewingAsOrgId && (
                <div className="bg-yellow-600/20 border border-yellow-500 rounded px-3 py-1">
                  <span className="text-yellow-200 text-sm font-semibold">
                    Tenant Mode: {organizations.find(o => o.id === viewingAsOrgId)?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {isSuperAdmin && !viewingAsOrgId && (
              <>
                <TabButton
                  isActive={activeTab === 'organizations'}
                  onClick={() => setActiveTab('organizations')}
                  label="🏢 Organizations"
                />
                <TabButton
                  isActive={activeTab === 'system'}
                  onClick={() => setActiveTab('system')}
                  label="⚙️ System"
                />
              </>
            )}
            <TabButton
              isActive={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              label="👥 Users"
            />
            <TabButton
              isActive={activeTab === 'scores'}
              onClick={() => setActiveTab('scores')}
              label="✏️ Scores"
            />
            <TabButton
              isActive={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              label="⚙️ Settings"
            />
            <TabButton
              isActive={activeTab === 'danger'}
              onClick={() => setActiveTab('danger')}
              label="⚠️ Danger Zone"
            />
          </div>

          {/* Tab Content */}
          {activeTab === 'organizations' && isSuperAdmin && !viewingAsOrgId && renderOrganizationsTab()}
          {activeTab === 'system' && isSuperAdmin && !viewingAsOrgId && renderSystemTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'scores' && renderScoresTab()}
          {activeTab === 'settings' && renderSettingsTab()}
          {activeTab === 'danger' && renderDangerTab()}

          {/* Message Display - Global */}
          {message && (
            <div className="mt-4 p-4 bg-white/20 rounded-lg text-white whitespace-pre-line">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
