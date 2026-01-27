#!/bin/bash

echo "🔍 Grordle Backend Troubleshooting Script"
echo "=========================================="
echo ""

# Check if .env file exists
echo "1. Checking .env file..."
if [ -f .env ]; then
    echo "   ✓ .env file exists"
    if grep -q "DATABASE_URL" .env; then
        echo "   ✓ DATABASE_URL is set"
    else
        echo "   ✗ DATABASE_URL not found in .env"
        exit 1
    fi
else
    echo "   ✗ .env file not found!"
    echo "   Create .env file with: DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"
    exit 1
fi

# Check if PostgreSQL is running
echo ""
echo "2. Checking PostgreSQL..."
if pg_isready -q; then
    echo "   ✓ PostgreSQL is running"
else
    echo "   ✗ PostgreSQL is not running"
    echo "   Start it with: sudo systemctl start postgresql"
    exit 1
fi

# Test database connection
echo ""
echo "3. Testing database connection..."
source .env
DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')
DB_USER=$(echo $DATABASE_URL | sed 's/.*:\/\/\([^:]*\):.*/\1/')
DB_HOST=$(echo $DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/')
DB_PASS=$(echo $DATABASE_URL | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')

PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Database connection successful"
else
    echo "   ✗ Cannot connect to database"
    echo "   Check your DATABASE_URL credentials"
    exit 1
fi

# Check database permissions
echo ""
echo "4. Checking database permissions..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE TABLE IF NOT EXISTS test_permissions (id INT); DROP TABLE test_permissions;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ User has CREATE TABLE permissions"
else
    echo "   ✗ User lacks CREATE permissions"
    echo "   Run: sudo -u postgres psql -d $DB_NAME -c \"GRANT CREATE ON SCHEMA public TO $DB_USER;\""
    exit 1
fi

# Check if API server port is available
echo ""
echo "5. Checking if port 3001 is available..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "   ⚠ Port 3001 is already in use"
    echo "   Kill process with: kill \$(lsof -ti:3001)"
else
    echo "   ✓ Port 3001 is available"
fi

# Check if Express is installed
echo ""
echo "6. Checking dependencies..."
if [ -d "node_modules/express" ]; then
    echo "   ✓ Express is installed"
else
    echo "   ✗ Express not found"
    echo "   Run: npm install"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All checks passed! You can now run:"
echo "   Terminal 1: npm run dev:api"
echo "   Terminal 2: npm run dev"
echo ""
