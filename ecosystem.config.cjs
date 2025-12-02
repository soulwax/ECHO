/* File: ecosystem.config.cjs */

/**
 * PM2 Ecosystem Configuration
 * 
 * Usage:
 *   - Production: pm2 start ecosystem.config.cjs --env production
 *   - Staging: pm2 start ecosystem.config.cjs --env staging
 *   - Development: pm2 start ecosystem.config.cjs --env development
 * 
 * Or use npm scripts:
 *   - npm run pm2:start:prod
 *   - npm run pm2:start:staging
 *   - npm run pm2:start:dev
 */

module.exports = {
  apps: [
    {
      name: 'echo',
      script: 'dist/scripts/migrate-and-start.js',
      interpreter: 'node',
      interpreter_args: '--enable-source-maps',
      
      // Process management
      instances: 1,
      exec_mode: 'fork', // Use 'cluster' for multi-core scaling
      
      // Restart behavior
      autorestart: true,
      watch: false, // Set to true for development auto-reload
      ignore_watch: [
        'node_modules',
        'logs',
        'data',
        '.git',
        'dist',
        '*.log',
      ],
      max_memory_restart: '1G',
      min_uptime: '10s', // Minimum uptime before considering app stable
      max_restarts: 10, // Max restarts within restart_delay
      restart_delay: 4000, // Delay between restarts (ms)
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
      merge_logs: true,
      log_type: 'json', // JSON format for better parsing
      combine_logs: true,
      
      // Node.js options
      node_args: '--enable-source-maps',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
      },
      env_development: {
        NODE_ENV: 'development',
        DEBUG: 'echo:*',
      },
      env_staging: {
        NODE_ENV: 'staging',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      
      // Monitoring & Health checks
      pmx: true, // Enable PM2 monitoring
      listen_timeout: 10000, // Time to wait for app to listen (ms)
      kill_timeout: 5000, // Time to wait for graceful shutdown (ms)
      
      // Advanced options
      instance_var: 'INSTANCE_ID', // Environment variable for instance ID
      wait_ready: false, // Wait for 'ready' event from app
      shutdown_with_message: false, // Graceful shutdown on SIGINT/SIGTERM
      
      // Source map support
      source_map_support: true,
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:soulwax/ECHO.git',
      path: '/var/www/echo',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
    },
  },
};
