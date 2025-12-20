# LibriVox Language Support - Deployment Guide

Complete guide for deploying the LibriVox Language Support API to production.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+
- 10GB+ free disk space
- `jq` (optional, for JSON parsing in scripts)

## Quick Start

### 1. One-Command Deployment

```bash
./deploy.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Install dependencies
- ✅ Build the application
- ✅ Set up PostgreSQL database
- ✅ Apply all migrations
- ✅ Run initial full sync (may take several hours)
- ✅ Start API server with daily cron sync
- ✅ Verify everything is working

### 2. Monitor Progress

While deployment is running, open a new terminal and run:

```bash
./monitor.sh
```

This shows real-time:
- Service status
- Books synced
- Database size
- API health
- Recent errors

## Deployment Scripts

### Main Deployment

```bash
# Full deployment (recommended for first time)
./deploy.sh

# Deploy without full sync (if database already populated)
FORCE_FULL_SYNC=false ./deploy.sh

# Test deployment (sync only 500 books)
FULL_SYNC_LIMIT=500 ./deploy.sh
```

### Service Management

```bash
# Stop all services
./stop.sh

# Start services (without full sync)
docker-compose up -d

# Restart services
docker-compose restart

# View logs
docker-compose logs -f api
docker-compose logs -f postgres
```

### Database Management

```bash
# Create backup
./backup.sh

# Restore from backup
./restore.sh backups/librivox_backup_20251220_120000.sql.gz

# Manual database access
docker-compose exec postgres psql -U librivox_user -d librivox
```

### Monitoring

```bash
# Real-time monitoring dashboard
./monitor.sh

# Check API health
curl http://localhost:3000/health | jq

# Check database stats
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT language, COUNT(*) FROM audiobooks GROUP BY language ORDER BY COUNT(*) DESC LIMIT 10;"
```

## Manual Sync Operations

### Full Sync

```bash
# Sync all books (resume from where it stopped)
node dist/scripts/run-sync.js --type=full

# Sync from specific offset
node dist/scripts/run-sync.js --type=full --resume=5000
```

### Incremental Sync

```bash
# Sync only changes since last sync
node dist/scripts/run-sync.js --type=incremental
```

**Note**: Incremental sync runs automatically daily at 2 AM UTC via cron.

## Configuration

### Environment Variables

Edit `.env` file:

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=librivox
DB_USER=librivox_user
DB_PASSWORD=your_secure_password_here  # ⚠️ CHANGE THIS!

# API Server
PORT=3000
NODE_ENV=production

# Sync Configuration
ENABLE_SYNC_CRON=true
SYNC_BATCH_SIZE=100
SYNC_RATE_LIMIT_MS=1000

# Logging
LOG_LEVEL=info
```

### Disable Daily Cron Sync

To disable automatic daily sync:

```bash
# In .env
ENABLE_SYNC_CRON=false
```

Then restart:

```bash
docker-compose restart api
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Set strong `DB_PASSWORD` in `.env`
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Allocate at least 10GB disk space
- [ ] Set up reverse proxy (nginx) with SSL
- [ ] Configure firewall to allow port 3000 (or your custom port)
- [ ] Set up database backup cron (daily)
- [ ] Configure log rotation
- [ ] Set up monitoring alerts
- [ ] Test backup and restore process
- [ ] Document your specific deployment configuration

## Server Deployment

### Deploy to Remote Server

```bash
# 1. Copy project to server
scp -r . user@server:/opt/librivox-api

# 2. SSH to server
ssh user@server

# 3. Navigate to directory
cd /opt/librivox-api

# 4. Run deployment
./deploy.sh
```

### Set Up as System Service (Systemd)

Create `/etc/systemd/system/librivox-api.service`:

```ini
[Unit]
Description=LibriVox Language Support API
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/librivox-api
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=your-user
Group=docker

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable librivox-api
sudo systemctl start librivox-api
sudo systemctl status librivox-api
```

### Set Up Backup Cron

Add to crontab:

```bash
# Daily backup at 3 AM
0 3 * * * cd /opt/librivox-api && ./backup.sh >> /var/log/librivox-backup.log 2>&1
```

## Nginx Reverse Proxy

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With SSL (Let's Encrypt):

```bash
sudo certbot --nginx -d api.yourdomain.com
```

## Monitoring & Alerts

### Set Up Health Check Monitoring

Use a service like UptimeRobot or create a simple monitor:

```bash
#!/bin/bash
# health-monitor.sh

HEALTH=$(curl -s http://localhost:3000/health)
STATUS=$(echo $HEALTH | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
    echo "API is unhealthy!" | mail -s "LibriVox API Alert" admin@example.com
fi
```

Add to crontab:

```bash
*/5 * * * * /opt/librivox-api/health-monitor.sh
```

### Log Monitoring

Monitor for errors:

```bash
tail -f logs/error.log
```

Set up log rotation in `/etc/logrotate.d/librivox-api`:

```
/opt/librivox-api/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 your-user your-user
    sharedscripts
}
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U librivox_user -d librivox
```

### API Not Responding

```bash
# Check API logs
docker-compose logs api

# Check if port is in use
netstat -tulpn | grep 3000

# Restart API
docker-compose restart api
```

### Sync Failures

```bash
# Check error logs
tail -100 logs/error.log

# Check sync status
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT * FROM sync_status WHERE status = 'failed' ORDER BY started_at DESC LIMIT 5;"

# Resume from last successful offset
node dist/scripts/run-sync.js --type=full --resume=<last_offset>
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Check database size
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT pg_size_pretty(pg_database_size('librivox'));"

# Clean old Docker images
docker system prune -a

# Clean old backups (keeps last 7)
./backup.sh  # This automatically cleans old backups
```

## Performance Tuning

### Increase Database Performance

Edit `docker-compose.yml` and add PostgreSQL tuning:

```yaml
postgres:
  environment:
    POSTGRES_INITDB_ARGS: "-c shared_buffers=256MB -c max_connections=100"
```

### Adjust Sync Speed

Edit `.env`:

```bash
# Faster sync (more load on LibriVox API)
SYNC_BATCH_SIZE=200
SYNC_RATE_LIMIT_MS=500

# Slower sync (gentler on LibriVox API)
SYNC_BATCH_SIZE=50
SYNC_RATE_LIMIT_MS=2000
```

## Scaling

### Horizontal Scaling

For high traffic, deploy multiple API instances behind a load balancer:

1. Deploy database on separate server
2. Run multiple API containers pointing to same database
3. Use nginx/HAProxy for load balancing
4. Only run cron on ONE instance to avoid duplicate syncs

### Database Replication

For read-heavy workloads, set up PostgreSQL replication:

1. Primary database for writes (sync operations)
2. Replica database(s) for reads (API queries)
3. Use connection pooling (PgBouncer)

## Security Best Practices

- ✅ Use strong database passwords
- ✅ Run behind reverse proxy with SSL
- ✅ Keep Docker images updated
- ✅ Limit database access to localhost only
- ✅ Set up firewall rules
- ✅ Regular security audits
- ✅ Implement rate limiting on API
- ✅ Monitor for unusual access patterns

## Backup Strategy

**Recommended**:
- Daily automated backups (via cron)
- Keep last 7 daily backups
- Monthly full backups (kept for 1 year)
- Test restore process monthly
- Store backups off-server (S3, etc.)

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Review `TECH_SPEC.md` for architecture details
3. Check GitHub issues
4. Review this deployment guide

## Useful Commands Reference

```bash
# Deployment
./deploy.sh                  # Full deployment
./stop.sh                    # Stop all services
./monitor.sh                 # Real-time monitoring

# Database
./backup.sh                  # Create backup
./restore.sh <file>          # Restore backup
docker-compose exec postgres psql -U librivox_user -d librivox  # DB access

# Sync
node dist/scripts/run-sync.js --type=full         # Full sync
node dist/scripts/run-sync.js --type=incremental  # Incremental

# Services
docker-compose up -d         # Start
docker-compose down          # Stop
docker-compose restart       # Restart
docker-compose logs -f api   # View logs

# API
curl http://localhost:3000/health                                    # Health
curl "http://localhost:3000/audiobooks?language=English&limit=10"   # List
curl http://localhost:3000/audiobooks/52                             # Detail
```
