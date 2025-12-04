# PM2 Process Management Guide

This guide covers the comprehensive PM2 setup for ISOBEL Discord bot.

## Quick Start

### First Time Setup

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start PM2 in production mode:**
   ```bash
   npm run pm2:start:prod
   ```

3. **Save PM2 configuration for auto-restart on reboot:**
   ```bash
   npm run pm2:save
   npm run pm2:startup  # Follow the instructions to enable auto-start on boot
   ```

## Available Scripts

### Starting & Stopping

- `npm run pm2:start` - Start in production mode (default)
- `npm run pm2:start:prod` - Start in production mode
- `npm run pm2:start:staging` - Start in staging mode
- `npm run pm2:start:dev` - Start in development mode
- `npm run pm2:stop` - Stop the echo process
- `npm run pm2:stop:all` - Stop all PM2 processes

### Restarting & Reloading

- `npm run pm2:restart` - Restart the echo process (downtime)
- `npm run pm2:restart:prod` - Restart in production mode
- `npm run pm2:restart:staging` - Restart in staging mode
- `npm run pm2:restart:dev` - Restart in development mode
- `npm run pm2:reload` - Zero-downtime reload (graceful restart)

### Logs

- `npm run pm2:logs` - View all logs (follow mode)
- `npm run pm2:logs:error` - View only error logs
- `npm run pm2:logs:out` - View only output logs
- `npm run pm2:logs:lines` - View last 100 lines of logs
- `npm run pm2:logs:flush` - Clear all PM2 logs

### Monitoring

- `npm run pm2:status` - Show process status
- `npm run pm2:info` - Show detailed information about echo process
- `npm run pm2:monit` - Open PM2 monitoring dashboard (CPU, memory, logs)
- `npm run pm2:list` - List all PM2 processes

### Management

- `npm run pm2:save` - Save current PM2 process list
- `npm run pm2:resurrect` - Restore saved PM2 process list
- `npm run pm2:delete` - Delete echo process from PM2
- `npm run pm2:delete:all` - Delete all PM2 processes
- `npm run pm2:reset` - Delete all processes and kill PM2 daemon
- `npm run pm2:update` - Update PM2 to latest version
- `npm run pm2:kill` - Kill PM2 daemon

### System Integration

- `npm run pm2:startup` - Generate startup script for auto-start on boot
- `npm run pm2:unstartup` - Remove startup script
- `npm run pm2:version` - Show PM2 version

## Environment Configuration

The ecosystem configuration supports three environments:

### Production
```bash
npm run pm2:start:prod
```
- `NODE_ENV=production`
- Optimized for performance
- Logging to files in `./logs/`

### Staging
```bash
npm run pm2:start:staging
```
- `NODE_ENV=staging`
- Useful for testing before production

### Development
```bash
npm run pm2:start:dev
```
- `NODE_ENV=development`
- `DEBUG=echo:*` enabled
- More verbose logging

## Configuration Details

### Process Management

- **Instances**: 1 (single instance)
- **Mode**: Fork mode (use cluster mode for multi-core scaling)
- **Auto-restart**: Enabled
- **Memory limit**: 1GB (auto-restart if exceeded)
- **Max restarts**: 10 within 4 seconds

### Logging

- **Error logs**: `./logs/pm2-error.log`
- **Output logs**: `./logs/pm2-out.log`
- **Combined logs**: `./logs/pm2-combined.log`
- **Format**: JSON with timestamps
- **Date format**: `YYYY-MM-DD HH:mm:ss Z`

### Health & Monitoring

- **PMX monitoring**: Enabled
- **Listen timeout**: 10 seconds
- **Kill timeout**: 5 seconds (graceful shutdown)
- **Min uptime**: 10 seconds (before considering stable)

## Common Workflows

### Deploying Updates

```bash
# 1. Build the application
npm run build

# 2. Reload PM2 (zero-downtime)
npm run pm2:reload

# Or restart (with brief downtime)
npm run pm2:restart
```

### Viewing Logs

```bash
# Follow all logs in real-time
npm run pm2:logs

# View last 100 lines
npm run pm2:logs:lines

# View only errors
npm run pm2:logs:error
```

### Monitoring Performance

```bash
# Open interactive monitoring dashboard
npm run pm2:monit

# Check status
npm run pm2:status

# Get detailed info
npm run pm2:info
```

### Troubleshooting

```bash
# Check if process is running
npm run pm2:status

# View recent logs
npm run pm2:logs:lines

# Restart if stuck
npm run pm2:restart

# Complete reset (if needed)
npm run pm2:reset
npm run pm2:start:prod
```

## Auto-Start on Boot

To enable PM2 to automatically start your application on system boot:

1. **Save current PM2 configuration:**
   ```bash
   npm run pm2:save
   ```

2. **Generate startup script:**
   ```bash
   npm run pm2:startup
   ```
   This will output a command to run with `sudo`. Copy and run it.

3. **Verify:**
   ```bash
   npm run pm2:status
   ```

To disable auto-start:
```bash
npm run pm2:unstartup
```

## Advanced Configuration

### Scaling (Cluster Mode)

To run multiple instances for better performance, edit `ecosystem.config.cjs`:

```javascript
instances: 4, // or 'max' for all CPU cores
exec_mode: 'cluster',
```

Then restart:
```bash
npm run pm2:restart
```

### Memory Limits

Adjust `max_memory_restart` in `ecosystem.config.cjs` to change the memory limit before auto-restart.

### Watch Mode (Development)

For auto-reload on file changes during development, edit `ecosystem.config.cjs`:

```javascript
watch: true,
```

Then start in dev mode:
```bash
npm run pm2:start:dev
```

## Log Rotation

PM2 logs can grow large over time. To manage them:

```bash
# Clear all logs
npm run pm2:logs:flush

# Or manually rotate logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [PM2 Monitoring](https://pm2.keymetrics.io/docs/usage/monitoring/)

