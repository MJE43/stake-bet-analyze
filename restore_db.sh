#!/bin/bash
# Database restoration script
# Run this from the project root directory

echo "🔄 Starting database restoration..."

# Create backup of current empty database
cd backend
cp pump.db "pump.db.empty_backup_$(date +%Y%m%d_%H%M%S)"
echo "✓ Created safety backup of current empty database"

# Copy backup database
cp ../pump.db pump.db
echo "✓ Restored database from backup"

# Verify restoration
python3 -c "
import sqlite3
conn = sqlite3.connect('pump.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM runs')
runs_count = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM live_streams')
streams_count = cursor.fetchone()[0]
conn.close()
print(f'✅ Restoration complete!')
print(f'   - Runs: {runs_count}')
print(f'   - Live streams: {streams_count}')
"

echo "🎉 Database restoration complete!"
echo "You can now start your server and verify the data is back."