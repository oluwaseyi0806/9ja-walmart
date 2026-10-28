#!/bin/bash
# ============================================================
# BACKUP: copies the database + seller photos into /root/backups, keeps 14 days.
# Run daily with cron:   crontab -e   then add:   30 2 * * * /root/9ja-walmart/deploy/backup.sh
# IMPORTANT: also download a backup to your own computer every week (scp or FileZilla).
# ============================================================
set -e
APP=/root/9ja-walmart; OUT=/root/backups; STAMP=$(date +%F_%H%M)
mkdir -p "$OUT"
sqlite3 "$APP/data.db" ".backup '$OUT/data-$STAMP.db'" 2>/dev/null || cp "$APP/data.db" "$OUT/data-$STAMP.db"
tar -czf "$OUT/uploads-$STAMP.tgz" -C "$APP/public" uploads
cp "$APP/.env" "$OUT/env-$STAMP.txt" && chmod 600 "$OUT/env-$STAMP.txt"
find "$OUT" -type f -mtime +14 -delete
echo "Backup done: $STAMP"
