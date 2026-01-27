# Wordlist Migration Guide for Vercel

## Overview

When hosting on Vercel, you can update and migrate the wordlist using the Admin Panel in your web application. No SSH or command-line access is required.

## Workflow for Updating the Wordlist

### 1. Update the Master File Locally

Edit `data/wordlist-table.txt` on your local machine:
```bash
# Example: Remove plural words
python3 << 'EOF'
with open('data/wordlist-table.txt', 'r') as f:
    lines = f.readlines()
# ... your modifications ...
EOF
```

### 2. Deploy to Vercel

Push your changes to Git, which triggers automatic deployment:
```bash
git add data/wordlist-table.txt
git commit -m "Update wordlist: removed four-letter plurals"
git push origin main
```

Vercel will automatically detect the push and redeploy your application with the updated file.

### 3. Run the Migration via Admin Panel

Once deployed:

1. Navigate to your application URL (e.g., `https://your-app.vercel.app`)
2. Log in with your user account
3. Go to the **Admin Panel** section
4. Enter the admin password (`admin123` by default)
5. Scroll to the **"📚 Wordlist Migration"** section
6. Click **"🔄 Run Wordlist Migration"**
7. Confirm the migration when prompted

The migration will:
- Read from the deployed `data/wordlist-table.txt` file
- Delete all existing words from the database
- Import all words from the file
- Show statistics about the migration

### 4. Verify the Migration

After the migration completes, you'll see:
- Number of words deleted
- Number of words imported
- Par distribution
- Average difficulty

## Alternative: Direct API Call

You can also trigger the migration directly via API using curl or Postman:

```bash
curl -X POST https://your-app.vercel.app/api/migrate-wordlist \
  -H "Content-Type: application/json" \
  -d '{"adminPassword":"admin123"}'
```

Response example:
```json
{
  "ok": true,
  "message": "Wordlist migration completed successfully",
  "deletedCount": 2867,
  "importedCount": 2153,
  "stats": {
    "totalWords": 2153,
    "parRange": "3 - 5",
    "avgDifficulty": 12.45
  },
  "distribution": [
    {"par": 3, "count": 1520},
    {"par": 4, "count": 543},
    {"par": 5, "count": 90}
  ]
}
```

## Important Files

- **`data/wordlist-table.txt`** - Master wordlist data (must be deployed with Vercel)
- **`api/migrate-wordlist.js`** - Vercel serverless function that runs the migration
- **`migrations/repopulate-wordlist.js`** - Local migration script (for development)

## Local Development

For local testing before deploying:

```bash
# Run migration locally
npm run migrate:wordlist

# Or run directly
node migrations/repopulate-wordlist.js up
```

## Security Note

**Change the default admin password!** The current password is `admin123` which should be changed for production use.

Update it in:
- `api/migrate-wordlist.js` (line 19)
- `src/components/AdminPanel.jsx` (ADMIN_PASSWORD constant)
- Other admin endpoints

## Vercel Configuration

Make sure `data/wordlist-table.txt` is included in your deployment. By default, Vercel includes all files in your repository. If you have a `.vercelignore` file, ensure the `data/` directory is not excluded.

## Troubleshooting

### Migration fails with "Wordlist file not found"

The file isn't being deployed. Check:
1. The file exists in your repository
2. The file is committed to Git
3. The file isn't listed in `.vercelignore`
4. The deployment completed successfully

### Migration times out

Vercel serverless functions have a 10-second timeout on the Hobby plan (60 seconds on Pro). If your wordlist is very large, you may need:
1. Upgrade to Vercel Pro for longer timeouts
2. Split the migration into smaller batches
3. Reduce the batch size in the migration code

### Database connection issues

Ensure your `DATABASE_URL` environment variable is set in Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DATABASE_URL` with your PostgreSQL connection string
3. Redeploy the application

## Summary

The migration process is simple:
1. **Update** `data/wordlist-table.txt` locally
2. **Deploy** to Vercel (git push)
3. **Run migration** from the Admin Panel
4. **Verify** the results

No command-line access to production needed! ✨
